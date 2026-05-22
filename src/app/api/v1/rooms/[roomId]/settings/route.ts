import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
export async function PATCH(req: NextRequest, {params}:{params:Promise<{roomId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const rid = parseInt((await params).roomId)
  const room = await queryOne<any>('SELECT * FROM rooms WHERE id=?',[rid]); if(!room) return errResponse('ROOM_NOT_FOUND')
  if(u.role!=='admin' && room.creator_id!==u.id) return errResponse('ROOM_NOT_LEADER')
  const {name,description,status} = await req.json()
  const f=[],v=[]
  if(name!==undefined){f.push('name=?');v.push(name)}
  if(description!==undefined){f.push('description=?');v.push(description)}
  if(status!==undefined){
    if(!['active','closed'].includes(status)) return errResponse('SYS_PARAM')
    f.push('status=?');v.push(status)
    f.push('closed_at=?');v.push(status==='closed'?new Date():null)
  }
  if(!f.length) return errResponse('SYS_PARAM')
  v.push(rid); await execute('UPDATE rooms SET '+f.join(',')+' WHERE id=?',v)
  return okResponse({message:'已更新'})
}
