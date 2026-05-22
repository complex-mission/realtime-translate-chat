import { NextRequest } from 'next/server'
import { getUser, hashPassword, revokeAll } from '@/lib/auth'
import { execute } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
import { validatePassword } from '@/lib/utils'
export async function POST(req: NextRequest, {params}:{params:Promise<{userId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  if(u.role!=='admin') return errResponse('USER_NO_PERM')
  const {new_password} = await req.json()
  const pe = validatePassword(new_password); if(pe) return errResponse('AUTH_PASSWORD_WEAK')
  const h = await hashPassword(new_password)
  await execute('UPDATE users SET password_hash=?, must_change_pw=FALSE WHERE id=?',[h,parseInt((await params).userId)])
  await revokeAll(parseInt((await params).userId))
  return okResponse({message:'已重置'})
}
