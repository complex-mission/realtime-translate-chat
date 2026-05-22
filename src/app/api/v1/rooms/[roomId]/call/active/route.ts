import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import redis from '@/lib/redis'
import { errResponse, okResponse } from '@/lib/errors'
import { signAvatars } from '@/lib/url-sign'

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')
  const rid = parseInt((await params).roomId)
  const cs = await redis.get('call:active:' + rid)
  if (!cs) return okResponse(null)

  const session = await queryOne('SELECT * FROM call_sessions WHERE id=?', [parseInt(cs)])
  const parts = await query(
    'SELECT cp.*,u.nickname,u.avatar_url FROM call_participants cp JOIN users u ON cp.user_id=u.id WHERE cp.call_session_id=? AND cp.left_at IS NULL',
    [parseInt(cs)]
  )

  return okResponse({ ...session, participants: signAvatars(parts) })
}
