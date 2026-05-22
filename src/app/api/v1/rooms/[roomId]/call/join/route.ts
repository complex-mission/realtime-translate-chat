import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import redis from '@/lib/redis'
import { errResponse, okResponse } from '@/lib/errors'
import { emitToRoom } from '@/socket'
import { generateRtcToken } from '@/lib/rtc-token'

export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')
  const rid = parseInt((await params).roomId)
  const room = await queryOne<any>('SELECT * FROM rooms WHERE id=?', [rid])
  if (!room) return errResponse('ROOM_NOT_FOUND')
  if (room.status === 'closed') return errResponse('ROOM_CLOSED')

  const channelId = 'room_' + rid
  const userId = 'user_' + u.id

  const existing = await redis.get('call:active:' + rid)
  let csId: number

  if (!existing) {
    const r = await execute("INSERT INTO call_sessions (room_id,started_by,status) VALUES (?,?,'active')", [rid, u.id])
    csId = r.insertId
    await redis.set('call:active:' + rid, String(csId))
    const sr = await execute('INSERT INTO messages (room_id,sender_id,msg_type,content) VALUES (?,?,?,?)', [rid, u.id, 'system', u.nickname + ' 发起了通话'])
    emitToRoom(rid, 'message:new', { id: sr.insertId, room_id: rid, sender_id: u.id, msg_type: 'system', content: u.nickname + ' 发起了通话', created_at: new Date().toISOString() })
    emitToRoom(rid, 'call:started', { call_session_id: csId, started_by: u.id })
  } else {
    csId = parseInt(existing)
  }

  await execute('INSERT IGNORE INTO call_participants (call_session_id,user_id) VALUES (?,?)', [csId, u.id])
  await execute('UPDATE call_sessions SET participant_count=participant_count+1 WHERE id=?', [csId])
  emitToRoom(rid, 'call:participant_joined', { call_session_id: csId, user_id: u.id, nickname: u.nickname })

  const { token, appId } = generateRtcToken(channelId, userId)

  return okResponse({
    call_session_id: csId,
    rtc_token: token,
    rtc_app_id: appId,
    rtc_channel: channelId,
    rtc_uid: userId,
  })
}
