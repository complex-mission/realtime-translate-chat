'use client'
import { useState } from 'react'
import { IconSearch, IconSpinner } from '@/components/ui/icon'

export default function AdminSearchPage() {
  const [q, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null

  const search = async () => {
    if (!q.trim() || !token) return
    setLoading(true); setSearched(true)
    const r = await fetch('/api/v1/admin/search?q=' + encodeURIComponent(q) + '&limit=50', { headers: { Authorization: 'Bearer ' + token } })
    const d = await r.json()
    if (d.success) setResults(d.data)
    setLoading(false)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">消息检索</h1>
        <p className="mt-0.5 text-sm text-slate-400">全文检索所有聊天室的历史消息</p>
      </div>

      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            className="w-full rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition"
            style={{ border: '1.5px solid var(--border-color)' }}
            onFocus={e => (e.target.style.borderColor = 'var(--blue-primary)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
            placeholder="输入关键词，按 Enter 搜索..."
          />
        </div>
        <button onClick={search} disabled={!q.trim() || loading}
          className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm text-white font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--blue-primary)' }}>
          {loading ? <IconSpinner size={14} /> : <IconSearch size={14} />} 搜索
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
          <IconSpinner size={16} className="text-[#1a73e8]" /> 搜索中...
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'var(--border-subtle)' }}>
            <IconSearch size={24} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-500">未找到相关消息</p>
          <p className="mt-1 text-xs text-slate-400">请尝试其他关键词</p>
        </div>
      )}

      <div className="space-y-2">
        {results.map(m => (
          <div key={m.id} className="rounded-xl bg-white p-4 transition hover:shadow-sm" style={{ border: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-2 text-xs mb-2">
              <span className="font-semibold text-slate-700">{m.sender_nickname}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{m.room_name}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{new Date(m.created_at).toLocaleString('zh-CN')}</span>
              {m.msg_type === 'voice_transcript' && (
                <span className="rounded-full px-2 py-0.5 text-xs font-medium text-slate-400" style={{ background: 'var(--border-subtle)' }}>语音</span>
              )}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{m.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
