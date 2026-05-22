import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
import { emitToRoom } from '@/socket'
export async function POST(req: NextRequest, {params}:{params:Promise<{roomId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const rid = parseInt((await params).roomId)
  const room = await queryOne<any>('SELECT * FROM rooms WHERE id=?',[rid]); if(!room) return errResponse('ROOM_NOT_FOUND')
  if(room.status==='closed') return errResponse('ROOM_CLOSED')
  if(u.role!=='admin' && room.creator_id!==u.id) return errResponse('ROOM_NOT_LEADER')
  await execute("UPDATE rooms SET status='closed',closed_at=NOW() WHERE id=?",[rid])
  emitToRoom(rid,'room:closed',{room_id:rid})
  return okResponse({message:'已关闭'})
}
