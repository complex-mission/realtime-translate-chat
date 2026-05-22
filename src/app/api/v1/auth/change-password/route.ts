import { NextRequest } from 'next/server'
import { getUser, verifyPassword, hashPassword, signAccessToken, signRefreshToken, genJti, track, revokeAll } from '@/lib/auth'
import { execute, queryOne } from '@/lib/db'
import redis from '@/lib/redis'
import { errResponse, okResponse } from '@/lib/errors'
import { getRefreshTokenCookie } from '@/lib/cookies'
import { validatePassword } from '@/lib/utils'
import type { User } from '@/types'

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return errResponse('AUTH_TOKEN_INVALID')

  const { old_password, new_password } = await req.json()

  // PRD 3.2: 验证旧密码
  if (!await verifyPassword(old_password, user.password_hash)) return errResponse('AUTH_INVALID_CREDENTIALS')

  // PRD 3.2: 新密码强度校验
  const pe = validatePassword(new_password)
  if (pe) return errResponse('AUTH_PASSWORD_WEAK')

  // PRD 15.5: 新旧密码不能相同
  if (await verifyPassword(new_password, user.password_hash)) return errResponse('AUTH_PASSWORD_SAME')

  // 更新密码
  const h = await hashPassword(new_password)
  await execute('UPDATE users SET password_hash=?, must_change_pw=FALSE, updated_at=NOW() WHERE id=?', [h, user.id])

  // PRD 15.5: 修改密码 → 吊销所有旧 token
  await revokeAll(user.id)

  // 重新查询用户以获取准确的 updated_at
  const fresh = await queryOne<User>('SELECT * FROM users WHERE id=?', [user.id])
  if (!fresh) return errResponse('USER_NOT_FOUND')

  // 签发新 token
  const jti = genJti()
  const at = signAccessToken(fresh, jti)
  const rt = signRefreshToken(user.id, jti)
  await redis.setex('refresh:' + jti, 604800, String(user.id))
  await track(user.id, jti)

  const res = okResponse({ access_token: at, expires_in: 7200 })
  res.headers.set('Set-Cookie', getRefreshTokenCookie(rt))
  return res
}
