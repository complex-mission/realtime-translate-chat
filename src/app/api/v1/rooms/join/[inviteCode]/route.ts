import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
export async function POST(req: NextRequest, {params}:{params:Promise<{inviteCode:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const {inviteCode} = await params
  const room = await queryOne<any>('SELECT * FROM rooms WHERE invite_code=?',[inviteCode]); if(!room) return errResponse('ROOM_INVITE_INVALID')
  if(room.status==='closed') return errResponse('ROOM_CLOSED')
  if(await queryOne('SELECT 1 FROM room_members WHERE room_id=? AND user_id=?',[room.id,u.id])) return okResponse({room_id:room.id,message:'已在房间内'})
  await execute('INSERT INTO room_members (room_id,user_id) VALUES (?,?)',[room.id,u.id])
  return okResponse({room_id:room.id})
}
