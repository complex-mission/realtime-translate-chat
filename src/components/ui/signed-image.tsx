'use client'
import { useState, useCallback, useEffect, ReactNode } from 'react'

interface SignedImageProps {
  src: string
  alt?: string
  className?: string
  onClick?: () => void
  onLoad?: () => void
  fallback?: ReactNode  // 加载完成前显示的占位内容
}

// 带签名刷新的图片组件
// 当 OSS 签名 URL 过期（403）时，自动请求新签名并重试
export default function SignedImage({ src, alt = '', className = '', onClick, onLoad, fallback }: SignedImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
    setRetryCount(0)

    // OSS key 需要先换签名 URL，直接 URL 可以直接用
    if (!src) { setFailed(true); return }
    if (src.startsWith('http') || src.startsWith('/')) {
      setCurrentSrc(src)
    } else {
      // OSS key：先拿签名 URL 再设置 src，避免直接塞入 key 触发破损闪烁
      const token = sessionStorage.getItem('access_token')
      fetch('/api/v1/files/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ keys: [src] }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success && data.data.urls[src]) {
            setCurrentSrc(data.data.urls[src])
          } else {
            setFailed(true)
          }
        })
        .catch(() => setFailed(true))
    }
  }, [src])

  const handleError = useCallback(async () => {
    if (retryCount >= 1 || !currentSrc) { setFailed(true); return }
    // 直接 URL 加载失败（可能是签名过期）：尝试重新签名一次
    if (!src.startsWith('http') && !src.startsWith('/')) {
      try {
        const token = sessionStorage.getItem('access_token')
        const res = await fetch('/api/v1/files/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ keys: [src] }),
        })
        const data = await res.json()
        if (data.success && data.data.urls[src]) {
          setCurrentSrc(data.data.urls[src])
          setRetryCount(1)
          return
        }
      } catch {}
    }
    setFailed(true)
  }, [src, currentSrc, retryCount])

  const handleLoad = useCallback(() => {
    setLoaded(true)
    onLoad?.()
  }, [onLoad])

  if (failed || !currentSrc) {
    // 加载失败或还未拿到 URL：显示 fallback，没有 fallback 才显示破图图标
    if (fallback) return <>{fallback}</>
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
    <>
      {/* 图片未加载完时显示 fallback，加载完成后隐藏 */}
      {!loaded && fallback && <>{fallback}</>}
      <img
        src={currentSrc}
        alt={alt}
        className={className}
        style={!loaded ? { display: 'none' } : undefined}
        onClick={onClick}
        onError={handleError}
        onLoad={handleLoad}
      />
    </>
  )
}
