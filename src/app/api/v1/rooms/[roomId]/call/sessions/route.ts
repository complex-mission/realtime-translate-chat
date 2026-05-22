import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
export async function GET(req: NextRequest, {params}:{params:Promise<{roomId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const rid = parseInt((await params).roomId)
  return okResponse(await query('SELECT cs.*,u.nickname as started_by_nickname FROM call_sessions cs JOIN users u ON cs.started_by=u.id WHERE cs.room_id=? ORDER BY cs.started_at DESC',[rid]))
}
