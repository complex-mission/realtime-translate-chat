'use client'
import { useEffect, useState } from 'react'
import { IconSpinner } from '@/components/ui/icon'

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null

  const fetchRooms = async () => {
    if (!token) return
    const r = await fetch('/api/v1/admin/rooms', { headers: { Authorization: 'Bearer ' + token } })
    const d = await r.json()
    if (d.success) setRooms(d.data)
    setLoading(false)
  }

  useEffect(() => { fetchRooms() }, [token])

  const toggleStatus = async (roomId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'closed' : 'active'
    const action = newStatus === 'closed' ? '关闭' : '开启'
    if (!confirm(`确定要${action}这个聊天室吗？`)) return

    setTogglingId(roomId)
    try {
      const r = await fetch(`/api/v1/admin/rooms/${roomId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ status: newStatus }),
      })
      const d = await r.json()
      if (d.success) {
        setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status: newStatus, closed_at: newStatus === 'closed' ? new Date().toISOString() : null } : r))
      } else {
        alert(d.error?.message_i18n?.zh || '操作失败')
      }
    } catch { alert('网络错误') } finally { setTogglingId(null) }
  }

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
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">操作</th>
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
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleStatus(r.id, r.status)}
                    disabled={togglingId === r.id}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      r.status === 'active'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                  >
                    {togglingId === r.id ? (
                      <span className="flex items-center gap-1"><IconSpinner size={12} /> 处理中...</span>
                    ) : (
                      r.status === 'active' ? '关闭' : '开启'
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {!rooms.length && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">暂无聊天室</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
