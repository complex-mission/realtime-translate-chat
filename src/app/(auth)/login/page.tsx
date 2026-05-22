'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { collectFingerprint } from '@/lib/fingerprint'
import { setAccessToken } from '@/hooks/useAuth'
import { IconChat, IconSpinner } from '@/components/ui/icon'

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'CM会议平台'
const appSlogan = process.env.NEXT_PUBLIC_APP_SLOGAN || '实时翻译 · 智能协作 · 无界沟通'
const appFooter = process.env.NEXT_PUBLIC_APP_FOOTER || '让沟通无界'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [failCount, setFailCount] = useState(0)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const fingerprint = await collectFingerprint()
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, fingerprint }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error?.message_i18n?.zh || '登录失败')
        if (data.error?.code?.includes('INVALID_CREDENTIALS')) setFailCount(prev => prev + 1)
        return
      }
      sessionStorage.setItem('access_token', data.data.access_token)
      sessionStorage.setItem('user', JSON.stringify(data.data.user))
      setAccessToken(data.data.access_token)
      router.push(data.data.user.must_change_pw ? '/change-password' : '/chat')
    } catch { setError('网络错误，请重试') } finally { setLoading(false) }
  }

  return (
    <div className="flex min-h-screen">
      {/* 左侧品牌展示区 */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)' }}>
        
        {/* 内容 */}
        <div className="relative z-10 flex flex-col px-12 xl:px-16">
          <div className="mb-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-6 shadow-lg" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
              <IconChat size={28} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">{appName}</h1>
            <p className="text-lg text-blue-100 mb-2">{appSlogan}</p>
            <p className="text-blue-200/70 max-w-md leading-relaxed">
              打破语言障碍，让全球团队无缝协作。支持多语言实时翻译、语音转写、智能会议纪要，让每一次沟通都高效而精准。
            </p>
          </div>
          
          {/* 特色功能 */}
          <div className="space-y-4 mt-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <svg className="h-5 w-5 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">实时翻译</h3>
                <p className="text-sm text-blue-200/70">支持中英日韩等多语言实时互译，消息即发即译</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <svg className="h-5 w-5 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">语音会议</h3>
                <p className="text-sm text-blue-200/70">高清语音通话，支持多人同时在线，零延迟沟通</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <svg className="h-5 w-5 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">智能纪要</h3>
                <p className="text-sm text-blue-200/70">自动生成会议摘要，关键信息一目了然</p>
              </div>
            </div>
          </div>
          
          {/* 底部信息 */}
          <div className="mt-12 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-sm text-blue-200/50">© {new Date().getFullYear()} {appName} · {appFooter}</p>
          </div>
        </div>
      </div>
      
      {/* 右侧登录区 */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8" style={{ background: '#f8fafc' }}>
        <div className="w-full max-w-md">
          {/* 移动端Logo */}
          <div className="mb-8 text-center lg:hidden">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4 shadow-lg" style={{ background: 'var(--blue-primary)' }}>
              <IconChat size={26} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{appName}</h1>
            <p className="mt-1.5 text-sm text-slate-500">实时翻译 · 智能协作</p>
          </div>
          
          {/* 桌面端标题 */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">欢迎回来</h2>
            <p className="text-slate-500">登录您的账号，开始高效会议</p>
          </div>
          
          {/* 登录卡片 */}
          <div className="rounded-2xl bg-white p-8 shadow-lg" style={{ border: '1px solid var(--border-subtle)' }}>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">用户名</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm text-slate-800 outline-none transition-all"
                  style={{ border: '1.5px solid var(--border-color)', background: '#fafbfc' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--blue-primary)'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.background = '#fafbfc' }}
                  autoComplete="username" required placeholder="请输入用户名" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">密码</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm text-slate-800 outline-none transition-all"
                  style={{ border: '1.5px solid var(--border-color)', background: '#fafbfc' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--blue-primary)'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.background = '#fafbfc' }}
                  autoComplete="current-password" required placeholder="请输入密码" />
              </div>
              {error && (
                <div className="rounded-xl p-3.5 text-sm" style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>
                  <p className="text-red-700">{error}</p>
                  {failCount > 0 && failCount < 5 && <p className="mt-1 text-xs text-red-500">还剩 {5 - failCount} 次机会</p>}
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full rounded-xl py-3 text-sm text-white font-semibold transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--blue-primary)' }}>
                {loading ? <span className="flex items-center justify-center gap-2"><IconSpinner size={16} /> 登录中...</span> : '登 录'}
              </button>
            </form>
          </div>
          
          {/* 底部帮助 */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              遇到问题？请联系管理员获取帮助
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
