import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

// 每项检查的超时（ms）
const TIMEOUT = 5000

async function withTimeout<T>(label: string, fn: () => Promise<T>): Promise<{ ok: boolean; latency: number; detail?: string }> {
  const t0 = Date.now()
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT)),
    ])
    return { ok: true, latency: Date.now() - t0 }
  } catch (e: any) {
    return { ok: false, latency: Date.now() - t0, detail: e?.message || String(e) }
  }
}

export async function GET(req: NextRequest) {
  const u = await getUser(req)
  if (!u || u.role !== 'admin') {
    return NextResponse.json({ success: false }, { status: 403 })
  }

  // 动态 import 避免 Edge Runtime 问题
  const { default: redis } = await import('@/lib/redis')
  const { query } = await import('@/lib/db')

  const [mysql, redisCheck, oss, dashscope, rtcCheck] = await Promise.all([
    // MySQL
    withTimeout('mysql', async () => {
      await query('SELECT 1')
    }),

    // Redis PING
    withTimeout('redis', async () => {
      const pong = await redis.ping()
      if (pong !== 'PONG') throw new Error('unexpected: ' + pong)
    }),

    // Aliyun OSS — HEAD bucket（不需要发文件，只测连通性）
    withTimeout('oss', async () => {
      const endpoint = process.env.OSS_ENDPOINT || 'https://oss-cn-beijing.aliyuncs.com'
      const bucket = process.env.OSS_BUCKET || ''
      const url = endpoint.replace('://', `://${bucket}.`)
      const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(TIMEOUT) })
      // 403 也算通，说明 OSS 服务可达（只是未鉴权）
      if (r.status >= 500) throw new Error('HTTP ' + r.status)
    }),

    // DashScope / Qwen API
    withTimeout('dashscope', async () => {
      const key = process.env.DASHSCOPE_API_KEY || ''
      if (!key) throw new Error('DASHSCOPE_API_KEY not set')
      const r = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/models', {
        headers: { Authorization: 'Bearer ' + key },
        signal: AbortSignal.timeout(TIMEOUT),
      })
      if (r.status === 401) throw new Error('API key invalid')
      if (r.status >= 500) throw new Error('HTTP ' + r.status)
    }),

    // Aliyun RTC — 检查 AppId 配置并 ping 域名
    withTimeout('rtc', async () => {
      const appId = process.env.RTC_APP_ID || ''
      if (!appId) throw new Error('RTC_APP_ID not set')
      const r = await fetch('https://rtc.aliyuncs.com/', {
        method: 'HEAD',
        signal: AbortSignal.timeout(TIMEOUT),
      })
      if (r.status >= 500) throw new Error('HTTP ' + r.status)
    }),
  ])

  const checks = [
    { id: 'mysql',     label: 'MySQL 数据库',         ...mysql,      config: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}` },
    { id: 'redis',     label: 'Redis 缓存',             ...redisCheck, config: (process.env.REDIS_URL || '').replace(/:[^:@]+@/, ':***@') },
    { id: 'oss',       label: 'Aliyun OSS 对象存储',   ...oss,        config: `${process.env.OSS_BUCKET}.${(process.env.OSS_ENDPOINT || '').replace('https://', '')}` },
    { id: 'dashscope', label: 'DashScope / Qwen AI',  ...dashscope,  config: `model: ${process.env.QWEN_TEXT_MODEL}` },
    { id: 'rtc',       label: 'Aliyun RTC 实时通话',   ...rtcCheck,   config: `AppId: ${process.env.RTC_APP_ID}` },
  ]

  const allOk = checks.every(c => c.ok)
  return NextResponse.json({
    success: true,
    data: {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
  })
}
