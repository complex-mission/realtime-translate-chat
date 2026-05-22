import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
export async function GET(req: NextRequest) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  if(u.role!=='admin') return errResponse('USER_NO_PERM')
  const url = new URL(req.url); const q=url.searchParams.get('q'), limit=parseInt(url.searchParams.get('limit')||'50')
  if(!q?.trim()) return errResponse('MSG_SEARCH_EMPTY')
  return okResponse(await query('SELECT m.*,u.nickname as sender_nickname,r.name as room_name FROM messages m JOIN users u ON m.sender_id=u.id JOIN rooms r ON m.room_id=r.id WHERE m.msg_type IN ("text","voice_transcript") AND MATCH(m.content) AGAINST(? IN BOOLEAN MODE) ORDER BY m.created_at DESC LIMIT ?',[q,limit]))
}
