import { NextRequest } from 'next/server'
import { verifyRefresh, signAccessToken, signRefreshToken, genJti, track, revoke } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import redis from '@/lib/redis'
import { errResponse, okResponse } from '@/lib/errors'
import { getRefreshTokenCookie } from '@/lib/cookies'
import { checkApiRateLimit } from '@/lib/ratelimit'
import type { User } from '@/types'

export async function POST(req: NextRequest) {
  // PRD 15.9: 刷新接口限流 单用户每分钟最多10次
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
  const rate = await checkApiRateLimit(null, ip, 'refresh')
  if (!rate.allowed) return errResponse('AUTH_IP_RATE')

  // PRD 15.3: 从 Cookie 获取 Refresh Token
  const cookies = req.headers.get('cookie') || ''
  const match = cookies.split(';').find(c => c.trim().startsWith('refresh_token='))
  const rt = match ? match.substring(match.indexOf('=') + 1) : undefined
  if (!rt) return errResponse('AUTH_REFRESH_INVALID')

  const p = verifyRefresh(rt)
  if (!p) return errResponse('AUTH_REFRESH_INVALID')

  // 检查 Refresh Token 是否存在
  if (!await redis.get('refresh:' + p.jti)) return errResponse('AUTH_REFRESH_INVALID')

  const user = await queryOne<User>('SELECT * FROM users WHERE id=?', [p.sub])
  if (!user || user.status !== 'active') return errResponse('AUTH_TOKEN_INVALID')

  // PRD 15.3: 旧 Refresh Token 立即失效
  await redis.del('refresh:' + p.jti)
  await revoke(p.jti, 604800)

  // 签发新令牌
  const jti = genJti()
  const at = signAccessToken(user, jti)
  const nrt = signRefreshToken(user.id, jti)
  await redis.setex('refresh:' + jti, 604800, String(user.id))
  await track(user.id, jti)

  const res = okResponse({ access_token: at, expires_in: 7200 })
  res.headers.set('Set-Cookie', getRefreshTokenCookie(nrt))
  return res
}
