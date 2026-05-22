import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
export async function DELETE(req: NextRequest, {params}:{params:Promise<{roomId:string;userId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const {roomId,userId} = await params; const rid=parseInt(roomId),uid=parseInt(userId)
  const room = await queryOne<any>('SELECT * FROM rooms WHERE id=?',[rid]); if(!room) return errResponse('ROOM_NOT_FOUND')
  if(u.role!=='admin' && room.creator_id!==u.id) return errResponse('ROOM_NOT_LEADER')
  if(uid===room.creator_id) return errResponse('USER_NO_PERM')
  await execute('DELETE FROM room_members WHERE room_id=? AND user_id=?',[rid,uid])
  return okResponse({message:'已踢出'})
}
