'use client'
import { useEffect, useState, createContext } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { User } from '@/types'
import { IconChat, IconSettings, IconUsers, IconHome, IconBook, IconSearch, IconSpinner, IconActivity } from '@/components/ui/icon'
import { setAccessToken } from '@/hooks/useAuth'

export const UserContext = createContext<{ user: User | null; setUser: (u: User | null) => void }>({ user: null, setUser: () => {} })

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = sessionStorage.getItem('user')
    if (stored) {
      setUser(JSON.parse(stored))
      setLoading(false)
    }

    const token = sessionStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    setAccessToken(token)

    const origFetch = window.fetch
    window.fetch = async (...args) => {
      const res = await origFetch(...args)
      if (res.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].toString() : ''
        if (!url.includes('/auth/login') && !url.includes('/auth/refresh')) {
          sessionStorage.clear()
          router.push('/login')
        }
      }
      return res
    }

    fetch('/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setUser(d.data)
          sessionStorage.setItem('user', JSON.stringify(d.data))
        } else {
          sessionStorage.clear()
          router.push('/login')
        }
      })
      .catch(() => {
        const stored = sessionStorage.getItem('user')
        if (stored) setUser(JSON.parse(stored))
      })
      .finally(() => setLoading(false))

    return () => { window.fetch = origFetch }
  }, [router])

  const nav = [
    { href: '/chat', icon: IconChat, label: '聊天室' },
    { href: '/profile', icon: IconSettings, label: '个人设置' },
  ]
  const adminNav = [
    { href: '/admin/users', icon: IconUsers, label: '用户管理' },
    { href: '/admin/rooms', icon: IconHome, label: '聊天室管理' },
    { href: '/admin/glossary', icon: IconBook, label: '术语表' },
    { href: '/admin/search', icon: IconSearch, label: '消息检索' },
    { href: '/admin/health', icon: IconActivity, label: '系统健康' },
  ]

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-bg)' }}>
        <div className="hidden w-60 shrink-0 lg:flex lg:flex-col shadow-xl" style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}>
          <div className="p-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
            <div className="flex items-center gap-2.5">
              <h2 className="text-md font-semibold text-white tracking-wide">{process.env.NEXT_PUBLIC_APP_NAME || 'CM会议平台'}</h2>
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--sidebar-text-muted)' }} suppressHydrationWarning>
              {user?.nickname || '\u00A0'} · {user?.role === 'admin' ? '管理员' : user?.role === 'leader' ? '室长' : user?.role ? '成员' : '\u00A0'}
            </p>
          </div>
          <nav className="flex-1 overflow-auto px-2 py-3 space-y-0.5">
            <p className="px-3 pb-1.5 pt-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--sidebar-text-muted)' }}>主面板</p>
            {nav.map(({ href, icon: Icon, label }) => (
              <a key={href} href={href} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                pathname === href
                  ? 'font-medium text-white shadow-sm'
                  : 'hover:text-white'
              }`}
              style={pathname === href
                ? { background: 'var(--blue-primary)' }
                : { color: 'var(--sidebar-text)' }}
              onMouseEnter={e => { if (pathname !== href) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-bg-hover)' }}
              onMouseLeave={e => { if (pathname !== href) (e.currentTarget as HTMLElement).style.background = '' }}
              >
                <Icon size={16} /> {label}
              </a>
            ))}
            <div className="my-3" style={{ borderTop: '1px solid var(--sidebar-border)' }} suppressHydrationWarning />
            <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--sidebar-text-muted)' }} suppressHydrationWarning>管理后台</p>
            {adminNav.map(({ href, icon: Icon, label }) => (
              <a key={href} href={href} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                pathname.startsWith(href) ? 'font-medium text-white' : ''
              } ${user?.role !== 'admin' ? 'hidden' : ''}`}
              style={pathname.startsWith(href)
                ? { background: 'var(--blue-primary)', color: 'white' }
                : { color: 'var(--sidebar-text)' }}
              onMouseEnter={e => { if (!pathname.startsWith(href)) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-bg-hover)' }}
              onMouseLeave={e => { if (!pathname.startsWith(href)) (e.currentTarget as HTMLElement).style.background = '' }}
              >
                <Icon size={16} /> {label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex items-center gap-3 text-blue-400"><IconSpinner size={20} /><span className="text-slate-500">加载中...</span></div>
            </div>
          ) : children}
        </div>
      </div>
    </UserContext.Provider>
  )
}
