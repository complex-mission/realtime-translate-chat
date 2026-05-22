'use client'
import { useEffect, useState, useContext } from 'react'
import { UserContext } from '../../layout'
import { useDialog } from '@/components/ui/dialog'
import SignedImage from '@/components/ui/signed-image'
import { IconSettings, IconCopy, IconUsers, IconUserPlus, IconUserMinus, IconCrown, IconUser, IconBook, IconPlus, IconX, IconSpinner } from '@/components/ui/icon'

interface Props {
  rid: number
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function RoomSettingsModal({ rid, open, onClose, onSaved }: Props) {
  const { user } = useContext(UserContext)
  const dialog = useDialog()
  const [room, setRoom] = useState<any>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [glossary, setGlossary] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [termForm, setTermForm] = useState({ term_zh: '', term_en: '', term_ja: '', note: '' })
  const [members, setMembers] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [showInvite, setShowInvite] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null

  useEffect(() => {
    if (!open || !token) return
    setLoading(true)
    ;(async () => {
      const r = await fetch('/api/v1/rooms/' + rid, { headers: { Authorization: 'Bearer ' + token } })
      const d = await r.json()
      if (d.success) { setRoom(d.data); setName(d.data.name); setDesc(d.data.description || ''); setMembers(d.data.members || []) }
      const g = await fetch('/api/v1/rooms/' + rid + '/glossary', { headers: { Authorization: 'Bearer ' + token } })
      const gd = await g.json()
      if (gd.success) setGlossary(gd.data)
      if (user?.role === 'admin') {
        const u = await fetch('/api/v1/admin/users?page_size=100', { headers: { Authorization: 'Bearer ' + token } })
        const ud = await u.json()
        if (ud.success) setAllUsers(ud.data.users)
      }
      setLoading(false)
    })()
  }, [open, rid, token, user])

  const save = async () => {
    setSaving(true); setSaveMsg('')
    try {
      const r = await fetch('/api/v1/rooms/' + rid + '/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name, description: desc }),
      })
      const d = await r.json()
      if (d.success) {
        setSaveMsg('已保存')
        onSaved?.()
      } else setSaveMsg(d.error?.message_i18n?.zh || '保存失败')
    } catch { setSaveMsg('网络错误') } finally { setSaving(false); setTimeout(() => setSaveMsg(''), 3000) }
  }

  const toggleRoomStatus = async () => {
    if (!room) return
    const newStatus = room.status === 'active' ? 'closed' : 'active'
    const action = newStatus === 'closed' ? '关闭' : '开启'
    const ok = await dialog.confirm({
      title: `${action}聊天室`,
      message: `确定要${action}这个聊天室吗？${newStatus === 'closed' ? '关闭后将无法发送消息和发起通话，但可以查看历史记录。' : ''}`,
      confirmText: action,
      variant: newStatus === 'closed' ? 'danger' : 'default',
    })
    if (!ok) return

    setSaving(true); setSaveMsg('')
    try {
      const r = await fetch('/api/v1/rooms/' + rid + '/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ status: newStatus }),
      })
      const d = await r.json()
      if (d.success) {
        setRoom((prev: any) => ({ ...prev, status: newStatus }))
        setSaveMsg(newStatus === 'closed' ? '已关闭' : '已开启')
        onSaved?.()
      } else setSaveMsg(d.error?.message_i18n?.zh || '操作失败')
    } catch { setSaveMsg('网络错误') } finally { setSaving(false); setTimeout(() => setSaveMsg(''), 3000) }
  }

  const addTerm = async () => {
    const r = await fetch('/api/v1/rooms/' + rid + '/glossary', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(termForm),
    })
    if ((await r.json()).success) {
      setShowAdd(false); setTermForm({ term_zh: '', term_en: '', term_ja: '', note: '' })
      const g = await fetch('/api/v1/rooms/' + rid + '/glossary', { headers: { Authorization: 'Bearer ' + token } })
      setGlossary((await g.json()).data || [])
    }
  }

  const delTerm = async (id: number) => {
    const ok = await dialog.confirm({ title: '删除术语', message: '确定要删除这条术语吗？', confirmText: '删除', variant: 'danger' })
    if (!ok) return
    await fetch('/api/v1/rooms/' + rid + '/glossary/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
    setGlossary(p => p.filter(t => t.id !== id))
  }

  const kick = async (uid: number, nickname: string) => {
    const ok = await dialog.confirm({ title: '踢出成员', message: `确定要将 ${nickname} 踢出聊天室吗？`, confirmText: '踢出', variant: 'danger' })
    if (!ok) return
    await fetch('/api/v1/rooms/' + rid + '/members/' + uid, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
    setMembers(p => p.filter(m => m.user_id !== uid))
  }

  const invite = async () => {
    await fetch('/api/v1/rooms/' + rid + '/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ user_ids: selected }),
    })
    setShowInvite(false); setSelected([])
    const r = await fetch('/api/v1/rooms/' + rid, { headers: { Authorization: 'Bearer ' + token } })
    setMembers((await r.json()).data?.members || [])
  }

  const copyLink = () => {
    if (!room) return
    const link = window.location.origin + '/chat/join/' + room.invite_code
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!open) return null

  const isLeader = user?.role === 'admin' || room?.creator_id === user?.id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <h2 className="text-lg font-semibold inline-flex items-center gap-2"><IconSettings size={20} /> 房间设置</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"><IconX size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex h-full items-center justify-center"><span className="text-gray-400">加载中...</span></div>
          ) : !room ? (
            <div className="flex h-full items-center justify-center"><span className="text-gray-400">加载失败</span></div>
          ) : (
            <>
              {/* 基本信息 */}
              <div className="mb-6 rounded-lg border bg-white p-5">
                <h3 className="mb-4 text-base font-semibold">基本信息</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">名称</label>
                    <input value={name} onChange={e => setName(e.target.value)} disabled={!isLeader}
                      className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">描述</label>
                    <textarea value={desc} onChange={e => setDesc(e.target.value)} disabled={!isLeader} rows={2}
                      className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">邀请链接</label>
                    <div className="mt-1 flex gap-2">
                      <input value={window.location.origin + '/chat/join/' + room.invite_code} readOnly
                        className="flex-1 rounded-lg border bg-gray-50 px-3 py-2.5 text-sm font-mono" />
                      <button onClick={copyLink}
                        className={`rounded-lg border px-4 py-2.5 text-sm transition ${copied ? 'bg-green-50 text-green-700 border-green-300' : 'hover:bg-gray-50'}`}>
                        {copied ? '已复制' : <><IconCopy size={14} className="inline" /> 复制</>}
                      </button>
                    </div>
                  </div>
                  {isLeader && (
                    <div className="flex items-center gap-3">
                      <button onClick={save} disabled={saving}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                        {saving ? <span className="flex items-center gap-1"><IconSpinner size={14} /> 保存中...</span> : '保存'}
                      </button>
                      {saveMsg && <span className="text-sm">{saveMsg}</span>}
                    </div>
                  )}

                  {/* 房间状态切换 */}
                  {isLeader && (
                    <div className="mt-4 rounded-lg border p-4" style={{ background: room.status === 'active' ? '#f0fdf4' : '#fef2f2' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            房间状态：
                            <span className={`ml-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              room.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                            }`}>
                              {room.status === 'active' ? '活跃中' : '已关闭'}
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {room.status === 'active' ? '关闭后将无法发送消息和发起通话' : '开启后可恢复消息发送和通话功能'}
                          </p>
                        </div>
                        <button
                          onClick={toggleRoomStatus}
                          disabled={saving}
                          className={`rounded-lg px-4 py-2 text-sm font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            room.status === 'active'
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {room.status === 'active' ? '关闭房间' : '开启房间'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 成员管理 */}
              <div className="mb-6 rounded-lg border bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold inline-flex items-center gap-2"><IconUsers size={18} /> 成员管理 ({members.length})</h3>
                  {isLeader && <button onClick={() => setShowInvite(true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 transition"><IconUserPlus size={14} className="inline" /> 邀请成员</button>}
                </div>
                <div className="space-y-2">
                  {members.map(m => (
                    <div key={m.user_id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 transition">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 overflow-hidden rounded-full bg-blue-100">
                          {m.avatar_url ? (
                            <SignedImage src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-medium text-blue-700">{m.nickname?.[0] || '?'}</div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{m.nickname}</p>
                          <p className="text-xs text-gray-400">
                            {m.role === 'leader' ? <span className="inline-flex items-center gap-1"><IconCrown size={12} className="text-yellow-600" /> 室长</span> : <span className="inline-flex items-center gap-1"><IconUser size={12} className="text-gray-400" /> 成员</span>} {m.department && '· ' + m.department}
                          </p>
                        </div>
                      </div>
                      {isLeader && m.user_id !== room.creator_id && (
                        <button onClick={() => kick(m.user_id, m.nickname)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition"><IconUserMinus size={12} className="inline" /> 踢出</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 房间术语表 */}
              <div className="mb-6 rounded-lg border bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold inline-flex items-center gap-2"><IconBook size={18} /> 房间术语表 ({glossary.length})</h3>
                  {isLeader && <button onClick={() => setShowAdd(true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 transition"><IconPlus size={14} className="inline" /> 添加术语</button>}
                </div>
                {!glossary.length ? (
                  <p className="py-4 text-center text-sm text-gray-400">暂无术语，翻译时将使用全局术语表</p>
                ) : (
                  <div className="space-y-2">
                    {glossary.map(t => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50">
                        <div className="text-sm">
                          <span className="font-medium">{t.term_zh || '-'}</span>
                          <span className="mx-2 text-gray-300">|</span>
                          <span>{t.term_en || '-'}</span>
                          <span className="mx-2 text-gray-300">|</span>
                          <span>{t.term_ja || '-'}</span>
                          {t.note && <span className="ml-2 text-xs text-gray-400">({t.note})</span>}
                        </div>
                        {isLeader && <button onClick={() => delTerm(t.id)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition"><IconX size={12} className="inline" /> 删除</button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 邀请弹窗 */}
        {showInvite && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowInvite(false)}>
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="mb-4 text-lg font-semibold inline-flex items-center gap-2"><IconUserPlus size={16} /> 邀请成员</h3>
              <div className="max-h-60 overflow-auto space-y-2">
                {allUsers.filter(u => !members.some(m => m.user_id === u.id)).map(u => (
                  <label key={u.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer transition">
                    <input type="checkbox" checked={selected.includes(u.id)}
                      onChange={e => { if (e.target.checked) setSelected(p => [...p, u.id]); else setSelected(p => p.filter(id => id !== u.id)) }} />
                    {u.nickname} ({u.username})
                  </label>
                ))}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setShowInvite(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 transition">取消</button>
                <button onClick={invite} disabled={!selected.length} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 transition"><IconUserPlus size={14} className="inline" /> 邀请 ({selected.length})</button>
              </div>
            </div>
          </div>
        )}

        {/* 添加术语弹窗 */}
        {showAdd && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="mb-4 text-lg font-semibold inline-flex items-center gap-2"><IconPlus size={16} /> 添加术语</h3>
              <div className="space-y-3">
                <input value={termForm.term_zh} onChange={e => setTermForm(f => ({ ...f, term_zh: e.target.value }))} className="w-full rounded-lg border px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="中文" />
                <input value={termForm.term_en} onChange={e => setTermForm(f => ({ ...f, term_en: e.target.value }))} className="w-full rounded-lg border px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="English" />
                <input value={termForm.term_ja} onChange={e => setTermForm(f => ({ ...f, term_ja: e.target.value }))} className="w-full rounded-lg border px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="日本語" />
                <input value={termForm.note} onChange={e => setTermForm(f => ({ ...f, note: e.target.value }))} className="w-full rounded-lg border px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="备注（选填）" />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setShowAdd(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 transition">取消</button>
                <button onClick={addTerm} disabled={!termForm.term_zh && !termForm.term_en && !termForm.term_ja}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 transition">添加</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
