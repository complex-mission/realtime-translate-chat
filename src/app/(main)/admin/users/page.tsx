'use client'
import { useEffect, useState } from 'react'
import { IconPlus, IconSpinner } from '@/components/ui/icon'
import { useToast } from '@/components/ui/toast'
import { useDialog } from '@/components/ui/dialog'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [form, setForm] = useState({ username: '', password: '', nickname: '', department: '', lang_pref: 'zh', role: 'member' })
  const [editForm, setEditForm] = useState({ nickname: '', department: '', lang_pref: 'zh', role: 'member' })
  const { toast } = useToast()
  const dialog = useDialog()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [actingId, setActingId] = useState<number | null>(null)
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    if (!token) return
    const r = await fetch('/api/v1/admin/users?page_size=100', { headers: { Authorization: 'Bearer ' + token } })
    const d = await r.json()
    if (d.success) setUsers(d.data.users)
    setLoading(false)
  }

  const createUser = async () => {
    setError('')
    setSubmitting(true)
    try {
      const r = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (d.success) {
        setShowCreate(false)
        setForm({ username: '', password: '', nickname: '', department: '', lang_pref: 'zh', role: 'member' })
        fetchUsers()
      } else setError(d.error?.message_i18n?.zh || '失败')
    } finally { setSubmitting(false) }
  }

  const openEdit = (u: any) => {
    setEditTarget(u)
    setEditForm({ nickname: u.nickname, department: u.department || '', lang_pref: u.lang_pref, role: u.role })
    setError('')
    setShowEdit(true)
  }

  const updateUser = async () => {
    if (!editTarget) return
    setError('')
    setEditSubmitting(true)
    try {
      const r = await fetch('/api/v1/admin/users/' + editTarget.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(editForm),
      })
      const d = await r.json()
      if (d.success) {
        setShowEdit(false)
        setEditTarget(null)
        fetchUsers()
        toast('success', '用户信息已更新')
      } else setError(d.error?.message_i18n?.zh || '更新失败')
    } finally { setEditSubmitting(false) }
  }

  const freeze = async (id: number) => {
    const ok = await dialog.confirm({ title: '冻结用户', message: '确定要冻结该用户吗？冻结后用户将无法登录。', confirmText: '冻结', variant: 'danger' })
    if (!ok) return
    setActingId(id)
    try {
      await fetch('/api/v1/admin/users/' + id + '/freeze', { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
      fetchUsers()
    } finally { setActingId(null) }
  }

  const unfreeze = async (id: number) => {
    setActingId(id)
    try {
      await fetch('/api/v1/admin/users/' + id + '/unfreeze', { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
      fetchUsers()
    } finally { setActingId(null) }
  }

  const resetPw = async (id: number) => {
    const pw = await dialog.prompt({ title: '重置密码', message: '请输入新密码，用户下次登录时生效。', placeholder: '新密码', inputType: 'password', confirmText: '重置' })
    if (!pw) return
    setActingId(id)
    try {
      const r = await fetch('/api/v1/admin/users/' + id + '/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ new_password: pw }),
      })
      const dr = await r.json()
      toast(dr.success ? 'success' : 'error', dr.success ? '密码已重置' : '重置失败')
    } finally { setActingId(null) }
  }

  const inputCls = "w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none transition"
  const inputStyle = { border: '1.5px solid var(--border-color)' }
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.target.style.borderColor = 'var(--blue-primary)')
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.target.style.borderColor = 'var(--border-color)')

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-3 text-blue-400"><IconSpinner size={20} /><span className="text-slate-500">加载中...</span></div>
    </div>
  )

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">用户管理</h1>
          <p className="mt-0.5 text-sm text-slate-400">共 {users.length} 名用户</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-white font-medium transition hover:opacity-90"
          style={{ background: 'var(--blue-primary)' }}>
          <IconPlus size={14} /> 创建用户
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white" style={{ border: '1px solid var(--border-color)' }}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--surface-bg)' }}>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">用户名</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">昵称</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">部门</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">语言</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">角色</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">状态</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="transition hover:bg-blue-50/40" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td className="px-4 py-3 text-slate-400 text-xs">{u.id}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{u.username}</td>
                <td className="px-4 py-3 text-slate-700">{u.nickname}</td>
                <td className="px-4 py-3 text-slate-500">{u.department || '-'}</td>
                <td className="px-4 py-3 text-slate-500 uppercase text-xs">{u.lang_pref}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    u.role === 'admin' ? 'bg-red-100 text-red-700' :
                    u.role === 'leader' ? 'bg-amber-100 text-amber-700' :
                    'text-slate-500'
                  }`} style={u.role === 'member' ? { background: 'var(--border-subtle)' } : {}}>
                    {u.role === 'admin' ? '管理员' : u.role === 'leader' ? '室长' : '成员'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {u.status === 'active' ? '正常' : '已冻结'}
                  </span>
                </td>
                <td className="px-4 py-3 space-x-3">
                  <button onClick={() => openEdit(u)} className="text-xs font-medium transition cursor-pointer" style={{ color: 'var(--blue-primary)' }}>编辑</button>
                  {u.status === 'active' ? (
                    <button onClick={() => freeze(u.id)} disabled={actingId === u.id} className="text-xs text-red-500 hover:text-red-700 font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      {actingId === u.id ? <span className="inline-flex items-center gap-1"><IconSpinner size={12} />处理中</span> : '冻结'}
                    </button>
                  ) : (
                    <button onClick={() => unfreeze(u.id)} disabled={actingId === u.id} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      {actingId === u.id ? <span className="inline-flex items-center gap-1"><IconSpinner size={12} />处理中</span> : '解冻'}
                    </button>
                  )}
                  <button onClick={() => resetPw(u.id)} disabled={actingId === u.id} className="text-xs font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" style={{ color: 'var(--blue-primary)' }}>
                    {actingId === u.id ? <span className="inline-flex items-center gap-1"><IconSpinner size={12} />处理中</span> : '重置密码'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--blue-light)' }}>
                <IconPlus size={18} className="text-[#1a73e8]" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">创建用户</h3>
            </div>
            {error && <p className="mb-4 rounded-xl px-3 py-2.5 text-sm text-red-700" style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>{error}</p>}
            <div className="space-y-3">
              <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="用户名" />
              <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} type="password" className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="初始密码" />
              <input value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="昵称" />
              <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="部门（选填）" />
              <select value={form.lang_pref} onChange={e => setForm(f => ({ ...f, lang_pref: e.target.value }))} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
                <option value="member">成员</option>
                <option value="leader">室长</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2 text-sm text-slate-600 font-medium transition hover:bg-slate-50" style={{ border: '1.5px solid var(--border-color)' }}>取消</button>
              <button onClick={createUser} disabled={submitting} className="rounded-xl px-4 py-2 text-sm text-white font-medium transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: 'var(--blue-primary)' }}>
                {submitting ? <span className="inline-flex items-center gap-1.5"><IconSpinner size={14} />创建中...</span> : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEdit && editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowEdit(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--blue-light)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800">编辑用户 <span className="text-sm font-normal text-slate-400">({editTarget.username})</span></h3>
            </div>
            {error && <p className="mb-4 rounded-xl px-3 py-2.5 text-sm text-red-700" style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>{error}</p>}
            <div className="space-y-3">
              <input value={editForm.nickname} onChange={e => setEditForm(f => ({ ...f, nickname: e.target.value }))} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="昵称" />
              <input value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="部门（选填）" />
              <select value={editForm.lang_pref} onChange={e => setEditForm(f => ({ ...f, lang_pref: e.target.value }))} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
              <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
                <option value="member">成员</option>
                <option value="leader">室长</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button onClick={() => setShowEdit(false)} className="rounded-xl px-4 py-2 text-sm text-slate-600 font-medium transition hover:bg-slate-50" style={{ border: '1.5px solid var(--border-color)' }}>取消</button>
              <button onClick={updateUser} disabled={editSubmitting} className="rounded-xl px-4 py-2 text-sm text-white font-medium transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: 'var(--blue-primary)' }}>
                {editSubmitting ? <span className="inline-flex items-center gap-1.5"><IconSpinner size={14} />保存中...</span> : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
