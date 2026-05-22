import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
export async function GET(req: NextRequest, {params}:{params:Promise<{roomId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const rid = parseInt((await params).roomId); const url = new URL(req.url)
  const q = url.searchParams.get('q'); const limit = parseInt(url.searchParams.get('limit')||'50')
  if(!q?.trim()) return errResponse('MSG_SEARCH_EMPTY')
  if(u.role!=='admin' && !await queryOne('SELECT 1 FROM room_members WHERE room_id=? AND user_id=?',[rid,u.id])) return errResponse('ROOM_NOT_INVITED')
  return okResponse(await query('SELECT m.*,u.nickname as sender_nickname FROM messages m JOIN users u ON m.sender_id=u.id WHERE m.room_id=? AND m.msg_type IN ("text","voice_transcript") AND MATCH(content) AGAINST(? IN BOOLEAN MODE) ORDER BY m.created_at DESC LIMIT ?',[rid,q,limit]))
}
