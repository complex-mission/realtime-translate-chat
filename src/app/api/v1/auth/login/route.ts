import { NextRequest } from 'next/server'
import { queryOne } from '@/lib/db'
import redis, { incrRedis } from '@/lib/redis'
import { verifyPassword, signAccessToken, signRefreshToken, genJti, track } from '@/lib/auth'
import { errResponse, okResponse } from '@/lib/errors'
import { getRefreshTokenCookie } from '@/lib/cookies'
import type { User } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { username, password, fingerprint } = await req.json()
    if (!username || !password) return errResponse('SYS_PARAM')

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') || '127.0.0.1'

    // PRD 3.3: IP级限流 24小时100次
    const ipCount = await incrRedis('auth:ip:' + ip, 86400)
    if (ipCount > 100) return errResponse('AUTH_IP_RATE')

    const user = await queryOne<User>('SELECT * FROM users WHERE username=?', [username])
    if (!user) return errResponse('AUTH_INVALID_CREDENTIALS')

    // PRD 3.3: 冻结检查
    const frozen = await redis.get('auth:frozen:' + user.id)
    if (frozen === 'perm') return errResponse('AUTH_FROZEN_PERM')
    if (frozen === 'temp') return errResponse('AUTH_FROZEN_TEMP')

    // PRD 3.3: 密码验证 + 失败计数
    if (!await verifyPassword(password, user.password_hash)) {
      const fc = await incrRedis('auth:fail:' + user.id, 300) // 5分钟TTL
      if (fc >= 5) {
        await redis.setex('auth:frozen:' + user.id, 300, 'temp')
        return errResponse('AUTH_FROZEN_TEMP')
      }
      return errResponse('AUTH_INVALID_CREDENTIALS')
    }

    // 清除失败计数
    await redis.del('auth:fail:' + user.id)

    // PRD 15.2/15.3: 生成双令牌
    const jti = genJti()
    const at = signAccessToken(user, jti, fingerprint)
    const rt = signRefreshToken(user.id, jti)
    await redis.setex('refresh:' + jti, 604800, String(user.id))
    await track(user.id, jti)

    const res = okResponse({
      user: {
        id: user.id, username: user.username, nickname: user.nickname,
        department: user.department,
        lang_pref: user.lang_pref, role: user.role,
        must_change_pw: user.must_change_pw, // PRD 3.1
      },
      access_token: at, expires_in: 7200,
    })

    // PRD 15.7: 动态 Cookie 配置
    res.headers.set('Set-Cookie', getRefreshTokenCookie(rt))
    return res
  } catch (e) { console.error('Login error:', e); return errResponse('SYS_INTERNAL') }
}
