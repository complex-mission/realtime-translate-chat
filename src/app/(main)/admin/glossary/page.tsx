'use client'
import { useEffect, useState } from 'react'
import { IconPlus, IconSpinner } from '@/components/ui/icon'
import { useDialog } from '@/components/ui/dialog'

export default function AdminGlossaryPage() {
  const [terms, setTerms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ term_zh: '', term_en: '', term_ja: '', note: '' })
  const dialog = useDialog()
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null

  useEffect(() => { fetchTerms() }, [])

  const fetchTerms = async () => {
    if (!token) return
    const r = await fetch('/api/v1/admin/glossary', { headers: { Authorization: 'Bearer ' + token } })
    const d = await r.json()
    if (d.success) setTerms(d.data)
    setLoading(false)
  }

  const addTerm = async () => {
    const r = await fetch('/api/v1/admin/glossary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(form),
    })
    if ((await r.json()).success) {
      setShowAdd(false)
      setForm({ term_zh: '', term_en: '', term_ja: '', note: '' })
      fetchTerms()
    }
  }

  const delTerm = async (id: number) => {
    const ok = await dialog.confirm({ title: '删除术语', message: '确定要删除这条术语吗？此操作不可撤销。', confirmText: '删除', variant: 'danger' })
    if (!ok) return
    await fetch('/api/v1/admin/glossary/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
    fetchTerms()
  }

  const inputCls = "w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none transition"
  const inputStyle = { border: '1.5px solid var(--border-color)' }
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = 'var(--blue-primary)')
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = 'var(--border-color)')

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-3 text-blue-400"><IconSpinner size={20} /><span className="text-slate-500">加载中...</span></div>
    </div>
  )

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">全局术语表</h1>
          <p className="mt-0.5 text-sm text-slate-400">共 {terms.length} 条术语</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-white font-medium transition hover:opacity-90"
          style={{ background: 'var(--blue-primary)' }}>
          <IconPlus size={14} /> 添加术语
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white" style={{ border: '1px solid var(--border-color)' }}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--surface-bg)' }}>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">中文</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">English</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">日本語</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">备注</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">操作</th>
            </tr>
          </thead>
          <tbody>
            {terms.map(t => (
              <tr key={t.id} className="transition hover:bg-blue-50/40" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td className="px-4 py-3 font-medium text-slate-700">{t.term_zh || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{t.term_en || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{t.term_ja || '-'}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{t.note || '-'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => delTerm(t.id)} className="text-xs text-red-500 hover:text-red-700 font-medium transition">删除</button>
                </td>
              </tr>
            ))}
            {!terms.length && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">暂无术语，点击右上角添加</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--blue-light)' }}>
                <IconPlus size={18} className="text-[#1a73e8]" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">添加术语</h3>
            </div>
            <div className="space-y-3">
              <input value={form.term_zh} onChange={e => setForm(f => ({ ...f, term_zh: e.target.value }))} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="中文" />
              <input value={form.term_en} onChange={e => setForm(f => ({ ...f, term_en: e.target.value }))} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="English" />
              <input value={form.term_ja} onChange={e => setForm(f => ({ ...f, term_ja: e.target.value }))} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="日本語" />
              <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="备注（选填）" />
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button onClick={() => setShowAdd(false)} className="rounded-xl px-4 py-2 text-sm text-slate-600 font-medium transition hover:bg-slate-50" style={{ border: '1.5px solid var(--border-color)' }}>取消</button>
              <button onClick={addTerm} disabled={!form.term_zh && !form.term_en && !form.term_ja}
                className="rounded-xl px-4 py-2 text-sm text-white font-medium transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--blue-primary)' }}>添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
