'use client'
import { useEffect, useState } from 'react'
import { IconSpinner } from '@/components/ui/icon'

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null

  useEffect(() => {
    (async () => {
      if (!token) return
      const r = await fetch('/api/v1/admin/rooms', { headers: { Authorization: 'Bearer ' + token } })
      const d = await r.json()
      if (d.success) setRooms(d.data)
      setLoading(false)
    })()
  }, [token])

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-3 text-blue-400"><IconSpinner size={20} /><span className="text-slate-500">加载中...</span></div>
    </div>
  )

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">聊天室管理</h1>
        <p className="mt-0.5 text-sm text-slate-400">共 {rooms.length} 个聊天室</p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white" style={{ border: '1px solid var(--border-color)' }}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--surface-bg)' }}>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">名称</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">创建者</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">成员</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">状态</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">邀请码</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">创建时间</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map(r => (
              <tr key={r.id} className="transition hover:bg-blue-50/40" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td className="px-4 py-3 text-slate-400 text-xs">{r.id}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{r.name}</td>
                <td className="px-4 py-3 text-slate-500">{r.creator_nickname}</td>
                <td className="px-4 py-3 text-slate-500">{r.member_count}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${r.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400'}`}
                    style={r.status !== 'active' ? { background: 'var(--border-subtle)' } : {}}>
                    {r.status === 'active' ? '活跃' : '已关闭'}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.invite_code}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{new Date(r.created_at).toLocaleString('zh-CN')}</td>
              </tr>
            ))}
            {!rooms.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">暂无聊天室</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
