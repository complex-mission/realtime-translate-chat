import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')
  if (u.role !== 'admin') return errResponse('USER_NO_PERM')

  const rid = parseInt((await params).roomId)
  const room = await queryOne<any>('SELECT * FROM rooms WHERE id=?', [rid])
  if (!room) return errResponse('ROOM_NOT_FOUND')

  const { status } = await req.json()
  if (!['active', 'closed'].includes(status)) return errResponse('SYS_PARAM')

  await execute('UPDATE rooms SET status=?, closed_at=? WHERE id=?', [
    status,
    status === 'closed' ? new Date() : null,
    rid,
  ])

  return okResponse({ message: status === 'closed' ? '聊天室已关闭' : '聊天室已开启', status })
}
