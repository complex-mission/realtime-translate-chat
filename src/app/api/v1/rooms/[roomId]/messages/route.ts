import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { query, queryOne, execute } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
import { emitToRoom } from '@/socket'
import { getSignedURL, isOSSConfigured } from '@/lib/oss'

// 刷新消息中的图片/头像签名 URL
function refreshSignedURLs(messages: any[]): any[] {
  if (!isOSSConfigured()) return messages

  return messages.map(msg => {
    const updated = { ...msg }

    // 图片消息: content 是 ossKey，同时生成缩略图 URL
    if (msg.msg_type === 'image' && msg.content && !msg.content.startsWith('/')) {
      updated.content = getSignedURL(msg.content, 86400)
      const thumbKey = msg.content.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '_thumb.webp')
      updated.thumb_url = getSignedURL(thumbKey, 86400)
    }

    // 头像: sender_avatar 是 ossKey
    if (msg.sender_avatar && !msg.sender_avatar.startsWith('/') && !msg.sender_avatar.startsWith('http')) {
      updated.sender_avatar = getSignedURL(msg.sender_avatar, 86400)
    }

    return updated
  })
}

// GET - 拉取消息
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')

  const rid = parseInt((await params).roomId)
  const url = new URL(req.url)
  const beforeId = url.searchParams.get('before_id')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)

  if (u.role !== 'admin' && !await queryOne('SELECT 1 FROM room_members WHERE room_id=? AND user_id=?', [rid, u.id]))
    return errResponse('ROOM_NOT_INVITED')

  let sql = 'SELECT m.*,u.nickname as sender_nickname,u.avatar_url as sender_avatar FROM messages m JOIN users u ON m.sender_id=u.id WHERE m.room_id=?'
  const p: any[] = [rid]
  if (beforeId) { sql += ' AND m.id<?'; p.push(parseInt(beforeId)) }
  sql += ' ORDER BY m.id DESC LIMIT ?'; p.push(limit)

  const messages = await query(sql, p)

  // 刷新签名 URL
  const refreshed = refreshSignedURLs(messages.reverse())

  return okResponse(refreshed)
}

// POST - 发送文字消息
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')

  const rid = parseInt((await params).roomId)
  const room = await queryOne<any>('SELECT * FROM rooms WHERE id=?', [rid])
  if (!room) return errResponse('ROOM_NOT_FOUND')
  if (room.status === 'closed') return errResponse('MSG_ROOM_CLOSED')

  if (u.role !== 'admin' && !await queryOne('SELECT 1 FROM room_members WHERE room_id=? AND user_id=?', [rid, u.id]))
    return errResponse('ROOM_NOT_INVITED')

  const { content } = await req.json()
  if (!content?.trim()) return errResponse('MSG_EMPTY')
  if (content.length > 5000) return errResponse('MSG_TOO_LONG')

  const r = await execute(
    'INSERT INTO messages (room_id,sender_id,msg_type,content) VALUES (?,?,?,?)',
    [rid, u.id, 'text', content.trim()]
  )

  const avatarUrl = u.avatar_url && !u.avatar_url.startsWith('/') && !u.avatar_url.startsWith('http')
    ? getSignedURL(u.avatar_url, 86400)
    : u.avatar_url

  const msg = {
    id: r.insertId, room_id: rid, sender_id: u.id, msg_type: 'text',
    content: content.trim(), original_lang: null, call_session_id: null,
    created_at: new Date().toISOString(),
    sender_nickname: u.nickname, sender_avatar: avatarUrl,
  }
  emitToRoom(rid, 'message:new', msg)
  return okResponse(msg, 201)
}
