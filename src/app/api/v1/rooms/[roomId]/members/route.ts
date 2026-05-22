import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
import { signAvatars } from '@/lib/url-sign'

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')
  const rid = parseInt((await params).roomId)
  if (u.role !== 'admin' && !await queryOne('SELECT 1 FROM room_members WHERE room_id=? AND user_id=?', [rid, u.id]))
    return errResponse('ROOM_NOT_INVITED')

  const members = await query(
    'SELECT rm.*,u.nickname,u.avatar_url,u.department,u.lang_pref FROM room_members rm JOIN users u ON rm.user_id=u.id WHERE rm.room_id=?',
    [rid]
  )

  return okResponse(signAvatars(members))
}
