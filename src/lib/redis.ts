import Redis from 'ioredis'

let _redis: Redis | null = null
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379/0', { maxRetriesPerRequest: 3 })
  }
  return _redis
}

const redis = new Proxy({} as Redis, {
  get(_, prop, receiver) {
    const target = getRedis()
    const val = Reflect.get(target, prop, receiver)
    return typeof val === 'function' ? val.bind(target) : val
  },
})

export default redis
export async function incrRedis(key: string, ttl?: number): Promise<number> {
  const r = getRedis()
  const v = await r.incr(key); if (ttl && v === 1) await r.expire(key, ttl); return v
}
