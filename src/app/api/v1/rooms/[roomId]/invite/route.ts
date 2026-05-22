import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
export async function POST(req: NextRequest, {params}:{params:Promise<{roomId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const rid = parseInt((await params).roomId)
  const room = await queryOne<any>('SELECT * FROM rooms WHERE id=?',[rid]); if(!room) return errResponse('ROOM_NOT_FOUND')
  if(room.status==='closed') return errResponse('ROOM_CLOSED')
  if(u.role!=='admin' && room.creator_id!==u.id) return errResponse('ROOM_NOT_LEADER')
  const {user_ids} = await req.json(); if(!user_ids?.length) return errResponse('ROOM_NO_INVITEES')
  let added=0; for(const uid of user_ids) { try{await execute('INSERT IGNORE INTO room_members (room_id,user_id) VALUES (?,?)',[rid,uid]);added++}catch{} }
  return okResponse({added})
}
