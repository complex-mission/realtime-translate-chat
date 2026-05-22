'use client'
import { useEffect, useState, useContext, useRef } from 'react'
import { UserContext } from '../layout'
import AvatarCrop from '@/components/ui/avatar-crop'
import SignedImage from '@/components/ui/signed-image'
import { useRouter } from 'next/navigation'
import { setAccessToken } from '@/hooks/useAuth'
import { IconSettings, IconCamera, IconLock, IconLogOut, IconSpinner } from '@/components/ui/icon'

export default function ProfilePage() {
  const { user, setUser } = useContext(UserContext)
  const router = useRouter()
  const [nick, setNick] = useState('')
  const [dept, setDept] = useState('')
  const [lang, setLang] = useState('zh')
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')
  const [saving, setSaving] = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) { setNick(user.nickname); setDept(user.department || ''); setLang(user.lang_pref) }
  }, [user])

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text); setMsgType(type); setTimeout(() => setMsg(''), 4000)
  }

  const save = async () => {
    setSaving(true)
    const token = sessionStorage.getItem('access_token')
    try {
      const r = await fetch('/api/v1/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ nickname: nick, department: dept, lang_pref: lang }),
      })
      const d = await r.json()
      if (d.success) {
        if (d.data.access_token) {
          sessionStorage.setItem('access_token', d.data.access_token)
          setAccessToken(d.data.access_token)
        }
        if (user) {
          const updated = { ...user, nickname: nick, department: dept, lang_pref: lang as any }
          setUser(updated)
          sessionStorage.setItem('user', JSON.stringify(updated))
        }
        showMessage('保存成功')
      } else showMessage(d.error?.message_i18n?.zh || '保存失败', 'error')
    } catch { showMessage('网络错误', 'error') } finally { setSaving(false) }
  }

  const changePw = async () => {
    if (!oldPw || !newPw) { showMessage('请填写密码', 'error'); return }
    setChangingPw(true)
    const token = sessionStorage.getItem('access_token')
    try {
      const r = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ old_password: oldPw, new_password: newPw }),
      })
      const d = await r.json()
      if (d.success) {
        showMessage('密码已修改')
        sessionStorage.setItem('access_token', d.data.access_token)
        setAccessToken(d.data.access_token)
        setOldPw(''); setNewPw('')
      } else showMessage(d.error?.message_i18n?.zh || '修改失败', 'error')
    } catch { showMessage('网络错误', 'error') } finally { setChangingPw(false) }
  }

  const logout = async () => {
    const token = sessionStorage.getItem('access_token')
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      })
    } finally {
      sessionStorage.clear()
      setAccessToken(null)
      setUser(null)
      router.push('/login')
    }
  }

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { showMessage('头像不能超过5MB', 'error'); return }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      showMessage('仅支持 JPG/PNG/GIF/WebP', 'error'); return
    }
    setAvatarFile(file)
  }

  const handleCropDone = async (blob: Blob) => {
    setAvatarFile(null)
    setUploadingAvatar(true)
    const token = sessionStorage.getItem('access_token')
    try {
      const fd = new FormData()
      fd.append('avatar', blob, 'avatar.jpg')
      const r = await fetch('/api/v1/profile/avatar', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: fd,
      })
      const d = await r.json()
      if (d.success) {
        if (d.data.access_token) {
          sessionStorage.setItem('access_token', d.data.access_token)
          setAccessToken(d.data.access_token)
        }
        if (user) {
          const updated = { ...user, avatar_url: d.data.avatar_url }
          setUser(updated)
          sessionStorage.setItem('user', JSON.stringify(updated))
        }
        showMessage('头像已更新')
      } else showMessage('上传失败', 'error')
    } catch { showMessage('网络错误', 'error') } finally { setUploadingAvatar(false) }
  }

  const inputCls = "w-full rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition"
  const inputStyle = { border: '1.5px solid var(--border-color)' }
  const focusInput = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.target.style.borderColor = 'var(--blue-primary)')
  const blurInput = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.target.style.borderColor = 'var(--border-color)')

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--blue-light)' }}>
          <IconSettings size={20} className="text-[#1a73e8]" />
        </div>
        <h1 className="text-xl font-bold text-slate-800">个人设置</h1>
      </div>

      {msg && (
        <div className={`mb-5 flex items-center justify-between rounded-xl p-3.5 text-sm font-medium ${
          msgType === 'success'
            ? 'text-emerald-700'
            : 'text-red-700'
        }`} style={msgType === 'success' ? { background: '#f0fdf4', border: '1px solid #bbf7d0' } : { background: '#fff5f5', border: '1px solid #fecaca' }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="ml-2 opacity-60 hover:opacity-100 font-bold">✕</button>
        </div>
      )}

      <div className="space-y-5">
        {/* 头像 */}
        <div className="rounded-2xl bg-white p-6" style={{ border: '1px solid var(--border-color)' }}>
          <h2 className="mb-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">头像</h2>
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="h-20 w-20 overflow-hidden rounded-2xl ring-1 ring-slate-200/60" style={{ background: 'var(--blue-light)' }}>
                {user?.avatar_url ? (
                  <SignedImage src={user.avatar_url} alt="头像" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[#1a73e8]">
                    {user?.nickname?.[0] || '?'}
                  </div>
                )}
              </div>
              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
                  <IconSpinner size={20} className="text-white" />
                </div>
              )}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleAvatarSelect} className="hidden" />
              <button onClick={() => fileRef.current?.click()} disabled={uploadingAvatar}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                style={{ border: '1.5px solid var(--border-color)' }}>
                <IconCamera size={15} /> 更换头像
              </button>
              <p className="mt-2 text-xs text-slate-400">支持 JPG/PNG/GIF/WebP，最大 5MB，可裁切</p>
            </div>
          </div>
        </div>

        {/* 基本信息 */}
        <div className="rounded-2xl bg-white p-6" style={{ border: '1px solid var(--border-color)' }}>
          <h2 className="mb-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">基本信息</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">昵称</label>
              <input value={nick} onChange={e => setNick(e.target.value)}
                className={inputCls} style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">部门</label>
              <input value={dept} onChange={e => setDept(e.target.value)}
                className={inputCls} style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">语言偏好</label>
              <select value={lang} onChange={e => setLang(e.target.value)}
                className={inputCls} style={inputStyle} onFocus={focusInput} onBlur={blurInput}>
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
              <p className="mt-1.5 text-xs text-slate-400">影响翻译目标语言和会议纪要生成语言</p>
            </div>
            <button onClick={save} disabled={saving}
              className="rounded-xl px-5 py-2.5 text-sm text-white font-medium transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--blue-primary)' }}>
              {saving ? <span className="flex items-center gap-1.5"><IconSpinner size={14} /> 保存中...</span> : '保存'}
            </button>
          </div>
        </div>

        {/* 修改密码 */}
        <div className="rounded-2xl bg-white p-6" style={{ border: '1px solid var(--border-color)' }}>
          <div className="mb-4 flex items-center gap-2">
            <IconLock size={16} className="text-[#1a73e8]" />
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">修改密码</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">当前密码</label>
              <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} autoComplete="current-password"
                className={inputCls} style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">新密码</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password"
                className={inputCls} style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
              <p className="mt-1.5 text-xs text-slate-400">至少8位，包含至少两种字符类型（大写/小写/数字/特殊符号）</p>
            </div>
            <button onClick={changePw} disabled={changingPw}
              className="rounded-xl px-5 py-2.5 text-sm text-white font-medium transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--blue-primary)' }}>
              {changingPw ? <span className="flex items-center gap-1.5"><IconSpinner size={14} /> 提交中...</span> : '修改密码'}
            </button>
          </div>
        </div>

        {/* 退出登录 */}
        <div className="rounded-2xl bg-white p-6" style={{ border: '1px solid var(--border-color)' }}>
          <button onClick={logout}
            className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
            style={{ border: '1.5px solid #fca5a5' }}>
            <IconLogOut size={15} className="inline mr-1.5" /> 退出登录
          </button>
        </div>
      </div>

      {avatarFile && (
        <AvatarCrop
          imageFile={avatarFile}
          onCrop={handleCropDone}
          onCancel={() => setAvatarFile(null)}
        />
      )}
    </div>
  )
}
