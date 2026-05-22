import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { execute } from '@/lib/db'
import redis from '@/lib/redis'
import { errResponse, okResponse } from '@/lib/errors'
export async function PATCH(req: NextRequest, {params}:{params:Promise<{id:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  if(u.role!=='admin') return errResponse('USER_NO_PERM')
  const body = await req.json(); const f=[],v=[]
  for(const k of ['term_zh','term_en','term_ja','note']) if(body[k]!==undefined){f.push(k+'=?');v.push(body[k])}
  if(!f.length) return errResponse('SYS_PARAM')
  v.push(parseInt((await params).id)); await execute('UPDATE glossaries SET '+f.join(',')+' WHERE id=?',v)
  await redis.del('glossary:global'); return okResponse({message:'已更新'})
}
export async function DELETE(req: NextRequest, {params}:{params:Promise<{id:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  if(u.role!=='admin') return errResponse('USER_NO_PERM')
  await execute('DELETE FROM glossaries WHERE id=?',[parseInt((await params).id)])
  await redis.del('glossary:global'); return okResponse({message:'已删除'})
}
