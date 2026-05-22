import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne, query, execute } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
import { getSignedURL, isOSSConfigured, batchDeleteFromOSS } from '@/lib/oss'
import { emitToRoom } from '@/socket'

function refreshAvatar(url: string | null): string | null {
  if (!url || !isOSSConfigured()) return url
  if (url.startsWith('/') || url.startsWith('http')) return url
  return getSignedURL(url, 86400)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')

  const rid = parseInt((await params).roomId)
  const room = await queryOne('SELECT * FROM rooms WHERE id=?', [rid])
  if (!room) return errResponse('ROOM_NOT_FOUND')

  if (u.role !== 'admin' && !await queryOne('SELECT 1 FROM room_members WHERE room_id=? AND user_id=?', [rid, u.id]))
    return errResponse('ROOM_NOT_INVITED')

  const members = await query(
    'SELECT rm.*,u.nickname,u.avatar_url FROM room_members rm JOIN users u ON rm.user_id=u.id WHERE rm.room_id=? ORDER BY rm.role DESC',
    [rid]
  )

  // 刷新头像签名
  const refreshedMembers = members.map((m: any) => ({
    ...m,
    avatar_url: refreshAvatar(m.avatar_url),
  }))

  return okResponse({ ...room, members: refreshedMembers })
}

// DELETE - 删除聊天室（仅管理员）
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')
  if (u.role !== 'admin') return errResponse('USER_NO_PERM')

  const rid = parseInt((await params).roomId)
  const room = await queryOne('SELECT * FROM rooms WHERE id=?', [rid])
  if (!room) return errResponse('ROOM_NOT_FOUND')

  // 获取所有图片消息的 OSS key
  const imageMessages = await query(
    "SELECT content FROM messages WHERE room_id=? AND msg_type='image'",
    [rid]
  )

  // 收集需要删除的 OSS keys（原图 + 缩略图）
  const ossKeys: string[] = []
  for (const msg of imageMessages) {
    const key = msg.content
    if (key && !key.startsWith('/')) {
      ossKeys.push(key)
      // 添加缩略图 key
      const thumbKey = key.replace('.webp', '_thumb.webp')
      if (thumbKey !== key) ossKeys.push(thumbKey)
    }
  }

  // 删除 OSS 文件
  if (ossKeys.length > 0 && isOSSConfigured()) {
    try {
      await batchDeleteFromOSS(ossKeys)
    } catch (e) {
      console.error('[Room Delete] Failed to delete OSS files:', e)
    }
  }

  // 删除本地文件
  if (!isOSSConfigured()) {
    const fs = await import('fs/promises')
    const path = await import('path')
    for (const key of ossKeys) {
      if (key.startsWith('/uploads/')) {
        try {
          await fs.unlink(path.join(process.cwd(), 'public', key))
        } catch (e) {
          // 忽略文件不存在的错误
        }
      }
    }
  }

  // 删除数据库记录（按依赖顺序）
  await execute('DELETE t FROM translations t JOIN messages m ON t.message_id=m.id WHERE m.room_id=?', [rid])
  await execute('DELETE cp FROM call_participants cp JOIN call_sessions cs ON cp.call_session_id=cs.id WHERE cs.room_id=?', [rid])
  await execute('DELETE FROM call_sessions WHERE room_id=?', [rid])
  await execute('DELETE FROM meeting_summaries WHERE room_id=?', [rid])
  await execute('DELETE FROM messages WHERE room_id=?', [rid])
  await execute('DELETE FROM room_members WHERE room_id=?', [rid])
  await execute('DELETE FROM rooms WHERE id=?', [rid])

  // 通知房间内所有用户
  emitToRoom(rid, 'room:closed', {})

  return okResponse({ deleted: true })
}
