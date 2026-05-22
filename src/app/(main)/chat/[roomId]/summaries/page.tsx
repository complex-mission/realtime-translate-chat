'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { IconFileText, IconX } from '@/components/ui/icon'
export default function SummariesPage() {
  const {roomId}=useParams<{roomId:string}>(); const [summaries,setSummaries]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [sel,setSel]=useState<any>(null)
  const token=typeof window!=='undefined'?sessionStorage.getItem('access_token'):null
  useEffect(()=>{(async()=>{if(!token)return;const r=await fetch('/api/v1/rooms/'+roomId+'/summaries',{headers:{Authorization:'Bearer '+token}});const d=await r.json();if(d.success)setSummaries(d.data);setLoading(false)})()},[roomId,token])
  if(loading)return<div className="p-8">加载中...</div>
  return (
    <div className="p-6"><h1 className="mb-6 text-2xl font-bold">会议纪要</h1>
      {!summaries.length?<p className="py-8 text-center text-gray-400">暂无纪要</p>:
      <div className="space-y-3">{summaries.map(s=><div key={s.id} onClick={()=>setSel(s)} className="cursor-pointer rounded-lg border bg-white p-4 hover:bg-gray-50">
        <div className="flex items-center justify-between"><p className="text-sm font-medium">{s.triggered_by_nickname} · {s.lang.toUpperCase()}</p><p className="text-xs text-gray-400">{new Date(s.created_at).toLocaleString('zh-CN')}</p></div>
        <p className="mt-2 text-sm text-gray-600 line-clamp-3">{s.content}</p></div>)}</div>}
      {sel&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={()=>setSel(null)}><div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">会议纪要</h3><button onClick={()=>setSel(null)} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"><IconX size={18} /></button></div>
        <div className="prose prose-sm max-w-none whitespace-pre-wrap">{sel.content}</div></div></div>}
    </div>
  )
}
