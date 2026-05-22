import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { execute } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
export async function PATCH(req: NextRequest, {params}:{params:Promise<{userId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  if(u.role!=='admin') return errResponse('USER_NO_PERM')
  const body = await req.json(); const f=[],v=[]
  for(const k of ['nickname','department','lang_pref','role']) if(body[k]!==undefined){f.push(k+'=?');v.push(body[k])}
  if(!f.length) return errResponse('SYS_PARAM')
  v.push(parseInt((await params).userId)); await execute('UPDATE users SET '+f.join(',')+' WHERE id=?',v)
  return okResponse({message:'已更新'})
}
