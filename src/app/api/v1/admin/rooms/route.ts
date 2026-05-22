import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
export async function GET(req: NextRequest) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  if(u.role!=='admin') return errResponse('USER_NO_PERM')
  return okResponse(await query('SELECT r.*,u.nickname as creator_nickname,(SELECT COUNT(*) FROM room_members WHERE room_id=r.id) as member_count FROM rooms r JOIN users u ON r.creator_id=u.id ORDER BY r.created_at DESC'))
}
