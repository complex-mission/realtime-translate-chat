import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import redis from '@/lib/redis'
import { errResponse, okResponse } from '@/lib/errors'
export async function PATCH(req: NextRequest, {params}:{params:Promise<{roomId:string;id:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const {roomId,id} = await params; const rid=parseInt(roomId)
  if(u.role!=='admin'){const m=await queryOne<any>('SELECT * FROM room_members WHERE room_id=? AND user_id=?',[rid,u.id]);if(!m||m.role!=='leader')return errResponse('GLOSSARY_EMPTY')}
  const body = await req.json(); const f=[],v=[]
  for(const k of ['term_zh','term_en','term_ja','note']) if(body[k]!==undefined){f.push(k+'=?');v.push(body[k])}
  if(!f.length) return errResponse('SYS_PARAM')
  v.push(parseInt(id)); await execute('UPDATE glossaries SET '+f.join(',')+' WHERE id=? AND room_id=?',[...v,rid])
  await redis.del('glossary:room:'+rid); return okResponse({message:'已更新'})
}
export async function DELETE(req: NextRequest, {params}:{params:Promise<{roomId:string;id:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const {roomId,id} = await params; const rid=parseInt(roomId)
  if(u.role!=='admin'){const m=await queryOne<any>('SELECT * FROM room_members WHERE room_id=? AND user_id=?',[rid,u.id]);if(!m||m.role!=='leader')return errResponse('GLOSSARY_EMPTY')}
  await execute('DELETE FROM glossaries WHERE id=? AND room_id=?',[parseInt(id),rid])
  await redis.del('glossary:room:'+rid); return okResponse({message:'已删除'})
}
