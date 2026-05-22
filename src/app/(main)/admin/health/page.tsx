'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  IconActivity, IconRefresh, IconSpinner,
  IconCheckCircle, IconXCircle, IconAlertTriangle,
  IconDatabase, IconZap, IconCloud, IconCpu, IconPhone, IconSettings,
  IconPlay, IconTranslate, IconUsers, IconEye, IconEyeOff,
} from '@/components/ui/icon'
import type { FC } from 'react'

interface CheckResult {
  id: string
  label: string
  ok: boolean
  latency: number
  detail?: string
  config?: string
}

interface HealthData {
  status: 'healthy' | 'degraded'
  timestamp: string
  checks: CheckResult[]
}

type ServiceIconComponent = FC<{ size?: number; className?: string }>

const SERVICE_ICONS: Record<string, ServiceIconComponent> = {
  mysql:     IconDatabase,
  redis:     IconZap,
  oss:       IconCloud,
  dashscope: IconCpu,
  rtc:       IconPhone,
}

const SERVICE_COLORS: Record<string, string> = {
  mysql:     '#3b82f6',
  redis:     '#f59e0b',
  oss:       '#0ea5e9',
  dashscope: '#8b5cf6',
  rtc:       '#10b981',
}

export default function AdminHealthPage() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null

  const toggleReveal = (id: string) =>
    setRevealed(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const fetchHealth = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const r = await fetch('/api/v1/admin/health', { headers: { Authorization: 'Bearer ' + token } })
      const d = await r.json()
      if (d.success) { setData(d.data); setLastFetch(new Date()) }
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchHealth() }, [fetchHealth])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(fetchHealth, 15000)
    return () => clearInterval(id)
  }, [autoRefresh, fetchHealth])

  const overallOk = data?.status === 'healthy'
  const degradedCount = data?.checks.filter(c => !c.ok).length ?? 0

  return (
    <div className="p-6 max-w-4xl">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--blue-light)' }}>
              <IconActivity size={20} className="text-[#1a73e8]" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">系统健康检查</h1>
          </div>
          <p className="ml-14 text-sm text-slate-400">
            {lastFetch ? `上次检查：${lastFetch.toLocaleTimeString('zh-CN')}` : '正在检查...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer select-none">
            <div
              onClick={() => setAutoRefresh(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${autoRefresh ? 'bg-[#1a73e8]' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${autoRefresh ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            自动刷新 (15s)
          </label>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-white font-medium transition hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--blue-primary)' }}
          >
            {loading ? <IconSpinner size={14} /> : <IconRefresh size={14} />}
            刷新
          </button>
        </div>
      </div>

      {/* 总体状态横幅 */}
      {data && (
        <div className="mb-6 rounded-2xl p-4 flex items-center gap-4"
          style={overallOk
            ? { background: '#f0fdf4', border: '1px solid #bbf7d0' }
            : { background: '#fff7ed', border: '1px solid #fed7aa' }
          }>
          {overallOk
            ? <IconCheckCircle size={28} className="text-emerald-500 shrink-0" />
            : <IconAlertTriangle size={28} className="text-amber-500 shrink-0" />
          }
          <div>
            <p className={`text-base font-semibold ${overallOk ? 'text-emerald-700' : 'text-amber-700'}`}>
              {overallOk ? '所有服务运行正常' : `${degradedCount} 个服务异常`}
            </p>
            <p className={`text-xs mt-0.5 ${overallOk ? 'text-emerald-600' : 'text-amber-600'}`}>
              检查时间：{new Date(data.timestamp).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
      )}

      {/* 加载占位 */}
      {loading && !data && (
        <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
          <IconSpinner size={20} className="text-[#1a73e8]" />
          <span>正在检查各服务状态...</span>
        </div>
      )}

      {/* 各服务卡片 */}
      {data && (
        <div className="space-y-3">
          {data.checks.map(c => {
            const ServiceIcon = SERVICE_ICONS[c.id] ?? IconSettings
            const color = SERVICE_COLORS[c.id] ?? '#64748b'
            return (
              <div key={c.id} className="rounded-2xl bg-white overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* 服务图标：用父容器 color 继承给 currentColor */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: color + '18', color }}>
                    <ServiceIcon size={20} />
                  </div>

                  {/* 名称 + 配置 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 text-sm">{c.label}</p>
                      {c.ok
                        ? <IconCheckCircle size={15} className="text-emerald-500" />
                        : <IconXCircle size={15} className="text-red-500" />
                      }
                    </div>
                    {c.config && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <p className="text-xs text-slate-400 font-mono truncate">
                          {revealed.has(c.id) ? c.config : c.config.replace(/[^\s·:]/g, '•')}
                        </p>
                        <button
                          onClick={() => toggleReveal(c.id)}
                          className="shrink-0 rounded p-0.5 text-slate-300 transition hover:text-slate-500"
                          title={revealed.has(c.id) ? '隐藏' : '显示'}
                        >
                          {revealed.has(c.id)
                            ? <IconEyeOff size={13} />
                            : <IconEye size={13} />
                          }
                        </button>
                      </div>
                    )}
                    {!c.ok && c.detail && (
                      <p className="mt-1 text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1 font-mono">{c.detail}</p>
                    )}
                  </div>

                  {/* 延迟 + 状态 */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                      c.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {c.ok ? '正常' : '异常'}
                    </span>
                    <span className={`text-xs font-mono ${
                      c.latency < 100 ? 'text-emerald-600' :
                      c.latency < 500 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {c.latency} ms
                    </span>
                  </div>
                </div>

                {/* 延迟进度条 */}
                <div className="h-1 w-full" style={{ background: 'var(--border-subtle)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: Math.min(c.latency / 50, 100) + '%',
                      background: c.ok
                        ? (c.latency < 100 ? '#10b981' : c.latency < 500 ? '#f59e0b' : '#ef4444')
                        : '#ef4444',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 快速测试区 */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">快速测试</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TestCard
            token={token}
            label="翻译 API 测试"
            Icon={IconTranslate}
            iconColor="#8b5cf6"
            description="发送一条测试翻译请求"
            action={async (tok) => {
              const r = await fetch('/api/v1/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
                body: JSON.stringify({ content: 'Hello', target_lang: 'zh' }),
              })
              const d = await r.json()
              if (d.success || d.error?.code?.includes('PARAM') || d.error?.code?.includes('MSG')) {
                return { ok: true, result: d.success ? ('译文：' + d.data?.translated) : ('API 可达 — ' + (d.error?.message_i18n?.zh || d.error?.code)) }
              }
              throw new Error(d.error?.message_i18n?.zh || 'API 异常')
            }}
          />
          <TestCard
            token={token}
            label="数据库查询测试"
            Icon={IconUsers}
            iconColor="#3b82f6"
            description="查询用户数与聊天室数"
            action={async (tok) => {
              const [u, ro] = await Promise.all([
                fetch('/api/v1/admin/users?page_size=1', { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.json()),
                fetch('/api/v1/admin/rooms', { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.json()),
              ])
              if (u.success && ro.success) {
                return { ok: true, result: `用户 ${u.data?.total ?? '?'} 人，聊天室 ${ro.data?.length ?? '?'} 个` }
              }
              throw new Error('查询失败')
            }}
          />
        </div>
      </div>
    </div>
  )
}

function TestCard({ token, label, Icon, iconColor, description, action }: {
  token: string | null
  label: string
  Icon: FC<{ size?: number; className?: string }>
  iconColor: string
  description: string
  action: (tok: string) => Promise<{ ok: boolean; result: string }>
}) {
  const [state, setState] = useState<'idle' | 'running' | 'ok' | 'error'>('idle')
  const [result, setResult] = useState('')
  const [latency, setLatency] = useState(0)

  const run = async () => {
    if (!token || state === 'running') return
    setState('running'); setResult(''); setLatency(0)
    const t0 = Date.now()
    try {
      const res = await action(token)
      setLatency(Date.now() - t0)
      setState(res.ok ? 'ok' : 'error')
      setResult(res.result)
    } catch (e: any) {
      setLatency(Date.now() - t0)
      setState('error')
      setResult(e?.message || '未知错误')
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4" style={{ border: '1px solid var(--border-color)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0" style={{ background: iconColor + '18', color: iconColor }}>
            <Icon size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{label}</p>
            <p className="text-xs text-slate-400">{description}</p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={state === 'running'}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white font-medium transition hover:opacity-90 disabled:opacity-50 shrink-0"
          style={{ background: 'var(--blue-primary)' }}
        >
          {state === 'running'
            ? <><IconSpinner size={12} /> 测试中</>
            : <><IconPlay size={12} /> 运行</>
          }
        </button>
      </div>

      {(state === 'ok' || state === 'error') && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-mono leading-relaxed"
          style={state === 'ok' ? { background: '#f0fdf4' } : { background: '#fff5f5' }}>
          {state === 'ok'
            ? <IconCheckCircle size={13} className="text-emerald-500 mt-0.5 shrink-0" />
            : <IconXCircle size={13} className="text-red-500 mt-0.5 shrink-0" />
          }
          <span className={state === 'ok' ? 'text-emerald-700' : 'text-red-700'}>
            {result}
            {latency > 0 && <span className="ml-2 opacity-50">{latency}ms</span>}
          </span>
        </div>
      )}
    </div>
  )
}
