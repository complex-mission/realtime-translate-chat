'use client'
// PRD 15.7: Access Token 存储在前端内存中（变量），不存 localStorage/sessionStorage
// Refresh Token 通过 HttpOnly Cookie 传输
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@/types'

// 模块级变量，内存存储
let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const refreshing = useRef(false)

  // 刷新 token
  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (refreshing.current) return accessToken
    refreshing.current = true
    try {
      const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        accessToken = data.data.access_token
        return accessToken
      }
      // 刷新失败 → 清除状态 → 跳登录
      accessToken = null
      setUser(null)
      router.push('/login')
      return null
    } finally {
      refreshing.current = false
    }
  }, [router])

  // 登录
  const login = useCallback(async (username: string, password: string, fingerprint: string) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, fingerprint }),
    })
    const data = await res.json()
    if (data.success) {
      accessToken = data.data.access_token
      setUser(data.data.user)
    }
    return data
  }, [])

  // 登出
  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken },
      })
    } finally {
      accessToken = null
      setUser(null)
      router.push('/login')
    }
  }, [router])

  // 带自动刷新的 fetch
  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    }
    if (accessToken) headers['Authorization'] = 'Bearer ' + accessToken

    let res = await fetch(url, { ...options, headers })

    // 401 → 尝试刷新
    if (res.status === 401 && accessToken) {
      const newToken = await refreshToken()
      if (newToken) {
        headers['Authorization'] = 'Bearer ' + newToken
        res = await fetch(url, { ...options, headers })
      }
    }

    return res
  }, [refreshToken])

  // 初始化：尝试刷新 token 获取用户信息
  useEffect(() => {
    const init = async () => {
      const newToken = await refreshToken()
      if (newToken) {
        try {
          const res = await fetch('/api/v1/auth/me', {
            headers: { Authorization: 'Bearer ' + newToken },
          })
          const data = await res.json()
          if (data.success) setUser(data.data)
        } catch {}
      }
      setLoading(false)
    }
    init()
  }, [refreshToken])

  return { user, setUser, loading, login, logout, authFetch, refreshToken }
}
