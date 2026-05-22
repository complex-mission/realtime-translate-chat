'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { IconSpinner } from '@/components/ui/icon'
import { useToast } from '@/components/ui/toast'
export default function JoinPage() {
  const {toast}=useToast()
  const {inviteCode}=useParams<{inviteCode:string}>(); const router=useRouter()
  useEffect(()=>{(async()=>{
    const token=sessionStorage.getItem('access_token'); if(!token){router.push('/login');return}
    const r=await fetch('/api/v1/rooms/join/'+inviteCode,{method:'POST',headers:{Authorization:'Bearer '+token}})
    const d=await r.json(); if(d.success)router.push('/chat/'+d.data.room_id); else{toast('error', d.error?.message_i18n?.zh||'加入失败');router.push('/chat')}
  })()},[inviteCode,router])
  return <div className="flex h-screen items-center justify-center"><p>加入中...</p></div>
}
