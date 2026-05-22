'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconLock, IconSpinner } from '@/components/ui/icon'
export default function ChangePasswordPage() {
  const router = useRouter(); const [oldPw,setOld]=useState(''); const [newPw,setNew]=useState(''); const [confirm,setConfirm]=useState('')
  const [error,setError]=useState(''); const [loading,setLoading]=useState(false)
  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault(); setError('')
    if(newPw!==confirm){setError('两次密码不一致');return}
    setLoading(true)
    try {
      const token=sessionStorage.getItem('access_token')
      const res=await fetch('/api/v1/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({old_password:oldPw,new_password:newPw})})
      const data=await res.json()
      if(!data.success){setError(data.error?.message_i18n?.zh||'修改失败');return}
      sessionStorage.setItem('access_token',data.data.access_token); router.push('/chat')
    } catch{setError('网络错误')} finally{setLoading(false)}
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-2 text-center text-2xl font-bold">修改密码</h1>
        <p className="mb-4 text-center text-sm text-gray-500">首次登录，请修改初始密码</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium">当前密码</label><input type="password" value={oldPw} onChange={e=>setOld(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" required /></div>
          <div><label className="block text-sm font-medium">新密码</label><input type="password" value={newPw} onChange={e=>setNew(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" required /><p className="mt-1 text-xs text-gray-400">至少8位，含两种以上字符</p></div>
          <div><label className="block text-sm font-medium">确认密码</label><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" required /></div>
          {error&&<p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{loading?'提交中...':'确认修改'}</button>
        </form>
      </div>
    </div>
  )
}
