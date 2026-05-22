import redis from './redis'
import type { User } from '@/types'

// PRD 15.9: API 速率限制
const LIMITS = {
  'default': { user: 200, ip: 500 },      // 每分钟
  'translate': { user: 60, ip: 120 },
  'summary': { user: 3, ip: 10 },
  'refresh': { user: 10, ip: 30 },
} as const

type LimitKey = keyof typeof LIMITS

export async function checkApiRateLimit(
  user: User | null,
  ip: string,
  category: LimitKey = 'default'
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const limits = LIMITS[category]
  const now = Math.floor(Date.now() / 1000)
  const windowKey = Math.floor(now / 60) // 1分钟窗口

  // IP限流
  const ipKey = 'ratelimit:api:ip:' + ip + ':' + windowKey
  const ipCount = await redis.incr(ipKey)
  if (ipCount === 1) await redis.expire(ipKey, 65)
  if (ipCount > limits.ip) return { allowed: false, retryAfter: 60 - (now % 60) }

  // 用户限流
  if (user) {
    const userKey = 'ratelimit:api:user:' + user.id + ':' + windowKey
    const userCount = await redis.incr(userKey)
    if (userCount === 1) await redis.expire(userKey, 65)
    if (userCount > limits.user) return { allowed: false, retryAfter: 60 - (now % 60) }
  }

  return { allowed: true }
}
