'use client'
import { useEffect, useState, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { UserContext } from '../layout'
import { useSocket } from '@/hooks/useSocket'
import { IconChat, IconPlus, IconSettings, IconUsers, IconHome, IconBook, IconSearch, IconMenu, IconX, IconSpinner, IconActivity, IconTrash } from '@/components/ui/icon'
import SignedImage from '@/components/ui/signed-image'

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'CM会议平台'

export default function ChatPage() {
  const { user } = useContext(UserContext)
  const router = useRouter()
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null
  const { on } = useSocket(token)

  useEffect(() => { fetchRooms(); if (user?.role === 'admin' || user?.role === 'leader') fetchUsers() }, [user])

  // PRD 16.12: 监听新消息更新未读数
  useEffect(() => {
    if (!on) return
    const unsub = on('message:new', (msg: any) => {
      setRooms(prev => prev.map(r => {
        if (r.id === msg.room_id) {
          return {
            ...r,
            last_message: msg.content,
            last_message_time: msg.created_at,
            unread: (r.unread || 0) + 1,
          }
        }
        return r
      }))
    })
    return unsub
  }, [on])

  const fetchRooms = async () => {
    if (!token) return
    try {
      const r = await fetch('/api/v1/rooms', { headers: { Authorization: 'Bearer ' + token } })
      const d = await r.json()
      if (d.success) setRooms(d.data)
    } finally { setLoading(false) }
  }

  const fetchUsers = async () => {
    if (!token) return
    const r = await fetch('/api/v1/admin/users?page_size=100', { headers: { Authorization: 'Bearer ' + token } })
    const d = await r.json()
    if (d.success) setAllUsers(d.data.users)
  }

  const createRoom = async () => {
    if (!token) return
    const r = await fetch('/api/v1/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ name: newName, description: newDesc, user_ids: selectedUsers }),
    })
    const d = await r.json()
    if (d.success) {
      setShowCreate(false); setNewName(''); setNewDesc(''); setSelectedUsers([]); fetchRooms()
    }
  }

  const enterRoom = (id: number) => {
    // 清除未读数
    setRooms(prev => prev.map(r => r.id === id ? { ...r, unread: 0 } : r))
    router.push('/chat/' + id)
  }

  const deleteRoom = async (id: number, name: string) => {
    if (!token) return
    if (!confirm(`确定要删除聊天室"${name}"吗？\n\n此操作将删除所有聊天记录和文件，且不可恢复。`)) return
    
    setDeleting(id)
    try {
      const r = await fetch('/api/v1/rooms/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      })
      const d = await r.json()
      if (d.success) {
        setRooms(prev => prev.filter(r => r.id !== id))
      } else {
        alert('删除失败：' + (d.error?.message_i18n?.zh || '未知错误'))
      }
    } catch {
      alert('删除失败，请重试')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-3 text-gray-500">
        <IconSpinner size={20} />
        <span>加载中...</span>
      </div>
    </div>
  )

  return (
    <div className="flex h-full">
      {/* 移动端顶部栏 */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-white px-4 py-3 lg:hidden" style={{ borderBottom: '1px solid var(--border-color)', boxShadow: '0 1px 4px rgba(26,115,232,0.06)' }}>
        <button onClick={() => setShowMobileMenu(true)} className="rounded-lg p-1.5 hover:bg-blue-50 text-slate-600 transition">
          <IconMenu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--blue-primary)' }}>
            <IconChat size={14} className="text-white" />
          </div>
          <h1 className="text-base font-semibold text-slate-800">聊天室</h1>
        </div>
        <div className="w-8" />
      </div>

      {/* 移动端侧滑菜单 */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
          <div className="absolute left-0 top-0 h-full w-64 shadow-2xl" style={{ background: 'var(--sidebar-bg)' }}>
            <div className="p-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--blue-primary)' }}>
                    <IconChat size={14} className="text-white" />
                  </div>
                  <h2 className="text-sm font-semibold text-white">{appName}</h2>
                </div>
                <button onClick={() => setShowMobileMenu(false)} className="rounded-lg p-1 transition" style={{ color: 'var(--sidebar-text-muted)' }}><IconX size={16} /></button>
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--sidebar-text-muted)' }}>{user?.nickname} · {user?.role === 'admin' ? '管理员' : user?.role === 'leader' ? '室长' : '成员'}</p>
            </div>
            <nav className="p-2 space-y-0.5">
              <a href="/chat" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-white" style={{ background: 'var(--blue-primary)' }}><IconChat size={16} /> 聊天室</a>
              <a href="/profile" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition" style={{ color: 'var(--sidebar-text)' }}><IconSettings size={16} /> 个人设置</a>
              {user?.role === 'admin' && (
                <>
                  <div className="my-2" style={{ borderTop: '1px solid var(--sidebar-border)' }} />
                  <a href="/admin/users" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition" style={{ color: 'var(--sidebar-text)' }}><IconUsers size={16} /> 用户管理</a>
                  <a href="/admin/rooms" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition" style={{ color: 'var(--sidebar-text)' }}><IconHome size={16} /> 聊天室管理</a>
                  <a href="/admin/glossary" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition" style={{ color: 'var(--sidebar-text)' }}><IconBook size={16} /> 术语表</a>
                  <a href="/admin/search" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition" style={{ color: 'var(--sidebar-text)' }}><IconSearch size={16} /> 消息检索</a>
                  <a href="/admin/health" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition" style={{ color: 'var(--sidebar-text)' }}><IconActivity size={16} /> 系统健康</a>
                </>
              )}
            </nav>
          </div>
        </div>
      )}

      {/* 房间列表 */}
      <div className="w-full bg-white overflow-auto pt-16 lg:pt-0 lg:w-80 flex-shrink-0" style={{ borderRight: '1px solid var(--border-color)' }}>
        <div className="sticky top-0 z-10 bg-white px-4 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <h2 className="text-sm font-semibold text-slate-700 hidden lg:block">聊天室列表</h2>
          {(user?.role === 'admin' || user?.role === 'leader') && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white font-medium transition hover:opacity-90 active:scale-95"
              style={{ background: 'var(--blue-primary)' }}>
              <IconPlus size={14} /> 新建
            </button>
          )}
        </div>
        <div className="p-3 space-y-1.5">
          {rooms.map(r => (
            <div key={r.id} onClick={() => enterRoom(r.id)}
              className="cursor-pointer rounded-xl bg-white p-3.5 transition-all duration-150 hover:shadow-md group"
              style={{ border: '1px solid var(--border-color)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#a8c4f5' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: 'var(--blue-primary)' }}>
                    {r.name?.[0]?.toUpperCase() || '#'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-slate-800 text-sm leading-snug truncate">{r.name}</h3>
                    {r.last_message && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{r.last_message}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {r.unread > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs text-white font-medium">
                      {r.unread > 99 ? '99+' : r.unread}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.status === 'active'
                      ? 'text-emerald-700'
                      : 'text-slate-400'
                  }`} style={r.status === 'active' ? { background: '#d1fae5' } : { background: '#f1f5f9' }}>
                    {r.status === 'active' ? '活跃' : '已关闭'}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-slate-400">{r.member_count} 名成员</p>
                <div className="flex items-center gap-2">
                  {r.last_message_time && (
                    <p className="text-xs text-slate-300">{new Date(r.last_message_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                  )}
                  {user?.role === 'admin' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRoom(r.id, r.name) }}
                      disabled={deleting === r.id}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                      title="删除聊天室"
                    >
                      {deleting === r.id ? <IconSpinner size={14} /> : <IconTrash size={14} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!rooms.length && (
            <div className="py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'var(--blue-light)' }}>
                <IconChat size={24} className="text-[#1a73e8]" />
              </div>
              <p className="text-sm font-medium text-slate-600">暂无聊天室</p>
              <p className="mt-1 text-xs text-slate-400">请联系管理员创建</p>
            </div>
          )}
        </div>
      </div>

      {/* 空状态 */}
      <div className="hidden flex-1 items-center justify-center lg:flex" style={{ background: 'var(--surface-bg)' }}>
        <div className="text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl mx-auto mb-4" style={{ background: 'var(--blue-light)' }}>
            <IconChat size={36} className="text-[#1a73e8]" />
          </div>
          <p className="text-lg font-semibold text-slate-700">选择一个聊天室开始</p>
          <p className="mt-1 text-sm text-slate-400">在左侧选择聊天室，或创建一个新的</p>
        </div>
      </div>

      {/* 创建房间弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--blue-light)' }}>
                <IconPlus size={18} className="text-[#1a73e8]" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">创建聊天室</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">名称 <span className="text-red-400">*</span></label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none transition"
                  style={{ border: '1.5px solid var(--border-color)' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--blue-primary)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
                  placeholder="聊天室名称" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none transition resize-none"
                  style={{ border: '1.5px solid var(--border-color)' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--blue-primary)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
                  rows={2} placeholder="可选" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">邀请成员 <span className="text-red-400">*</span></label>
                <div className="max-h-40 overflow-auto rounded-xl p-2 space-y-0.5" style={{ border: '1.5px solid var(--border-color)' }}>
                  {allUsers.filter(u => u.id !== user?.id).map(u => (
                    <label key={u.id} className="flex items-center gap-2.5 text-sm cursor-pointer rounded-lg px-2.5 py-2 transition hover:bg-blue-50">
                      <input type="checkbox" checked={selectedUsers.includes(u.id)}
                        onChange={e => { if (e.target.checked) setSelectedUsers(p => [...p, u.id]); else setSelectedUsers(p => p.filter(id => id !== u.id)) }}
                        className="accent-blue-600 h-4 w-4" />
                      <div className="h-8 w-8 overflow-hidden rounded-full shrink-0" style={{ background: '#e0e7ff' }}>
                        {u.avatar_url ? (
                          <SignedImage src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-indigo-600">{u.nickname?.[0] || '?'}</div>
                        )}
                      </div>
                      <span className="text-slate-700">{u.nickname}</span>
                      <span className="text-slate-400 text-xs">@{u.username}</span>
                    </label>
                  ))}
                  {!allUsers.length && <p className="text-xs text-slate-400 py-2 text-center">暂无可用用户</p>}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button onClick={() => setShowCreate(false)}
                className="rounded-xl px-4 py-2 text-sm text-slate-600 font-medium transition hover:bg-slate-50"
                style={{ border: '1.5px solid var(--border-color)' }}>
                取消
              </button>
              <button onClick={createRoom} disabled={!newName.trim() || !selectedUsers.length}
                className="rounded-xl px-4 py-2 text-sm text-white font-medium transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--blue-primary)' }}>
                创建 ({selectedUsers.length}人)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
