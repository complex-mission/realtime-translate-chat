import { NextRequest } from 'next/server'
import { getUser, revokeAll } from '@/lib/auth'
import { execute } from '@/lib/db'
import redis from '@/lib/redis'
import { errResponse, okResponse } from '@/lib/errors'
export async function POST(req: NextRequest, {params}:{params:Promise<{userId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  if(u.role!=='admin') return errResponse('USER_NO_PERM')
  const uid = parseInt((await params).userId)
  await execute("UPDATE users SET status='frozen_perm' WHERE id=?",[uid])
  await redis.set('auth:frozen:'+uid,'perm'); await revokeAll(uid)
  return okResponse({message:'已冻结'})
}
