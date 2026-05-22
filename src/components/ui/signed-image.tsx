'use client'
import { useState, useCallback } from 'react'

interface SignedImageProps {
  src: string
  alt?: string
  className?: string
  onClick?: () => void
  onLoad?: () => void
}

// 带签名刷新的图片组件
// 当 OSS 签名 URL 过期（403）时，自动请求新签名并重试
export default function SignedImage({ src, alt = '', className = '', onClick, onLoad }: SignedImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src)
  const [retryCount, setRetryCount] = useState(0)
  const [failed, setFailed] = useState(false)

  const handleError = useCallback(async () => {
    if (retryCount >= 2) { setFailed(true); return }

    // 只有 OSS key（非本地路径、非完整URL）才需要刷新签名
    if (currentSrc.startsWith('/') || currentSrc.startsWith('http')) {
      setFailed(true)
      return
    }

    try {
      const token = sessionStorage.getItem('access_token')
      const res = await fetch('/api/v1/files/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ keys: [currentSrc] }),
      })
      const data = await res.json()
      if (data.success && data.data.urls[currentSrc]) {
        setCurrentSrc(data.data.urls[currentSrc])
        setRetryCount(prev => prev + 1)
      } else {
        setFailed(true)
      }
    } catch {
      setFailed(true)
    }
  }, [currentSrc, retryCount])

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
    )
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onClick={onClick}
      onError={handleError}
      onLoad={onLoad}
    />
  )
}
