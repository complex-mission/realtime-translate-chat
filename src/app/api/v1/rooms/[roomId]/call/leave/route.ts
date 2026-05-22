import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import redis from '@/lib/redis'
import { errResponse, okResponse } from '@/lib/errors'
import { emitToRoom } from '@/socket'
export async function POST(req: NextRequest, {params}:{params:Promise<{roomId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const rid = parseInt((await params).roomId)
  const cs = await redis.get('call:active:'+rid); if(!cs) return errResponse('CALL_NOT_FOUND')
  const csId = parseInt(cs)
  await execute('UPDATE call_participants SET left_at=NOW() WHERE call_session_id=? AND user_id=? AND left_at IS NULL',[csId,u.id])
  const cnt = await queryOne<any>('SELECT COUNT(*) as c FROM call_participants WHERE call_session_id=? AND left_at IS NULL',[csId])
  if(!cnt?.c) {
    await execute("UPDATE call_sessions SET status='ended',ended_at=NOW() WHERE id=?",[csId])
    await redis.del('call:active:'+rid)
    const sr = await execute('INSERT INTO messages (room_id,sender_id,msg_type,content) VALUES (?,?,?,?)',[rid,u.id,'system','通话已结束'])
    emitToRoom(rid,'message:new',{id:sr.insertId,room_id:rid,sender_id:u.id,msg_type:'system',content:'通话已结束',created_at:new Date().toISOString()})
    emitToRoom(rid,'call:ended',{call_session_id:csId,ended_at:new Date().toISOString()})
  }
  emitToRoom(rid,'call:participant_left',{call_session_id:csId,user_id:u.id})
  return okResponse({message:'已退出'})
}
