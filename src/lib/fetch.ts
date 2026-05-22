import type { ApiResponse } from '@/types'

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

async function doRefresh(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise(resolve => { refreshQueue.push(resolve) })
  }
  isRefreshing = true
  try {
    const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    const data = await res.json()
    if (data.success) {
      const newToken = data.data.access_token
      sessionStorage.setItem('access_token', newToken)
      refreshQueue.forEach(cb => cb(newToken))
      refreshQueue = []
      return newToken
    }
    // Refresh failed -> redirect to login
    sessionStorage.clear()
    window.location.href = '/login'
    return null
  } finally {
    isRefreshing = false
  }
}

export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  let token = sessionStorage.getItem('access_token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = 'Bearer ' + token

  let res = await fetch(url, { ...options, headers })

  // 401 -> try refresh
  if (res.status === 401 && token) {
    const newToken = await doRefresh()
    if (newToken) {
      headers['Authorization'] = 'Bearer ' + newToken
      res = await fetch(url, { ...options, headers })
    }
  }

  const data = await res.json()

  // Rate limited
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After') || '60'
    throw new Error('请求过于频繁，请' + retryAfter + '秒后重试')
  }

  return data
}

export async function apiUpload<T = any>(
  url: string,
  formData: FormData
): Promise<ApiResponse<T>> {
  const token = sessionStorage.getItem('access_token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = 'Bearer ' + token
  // Don't set Content-Type for FormData, let browser set boundary
  const res = await fetch(url, { method: 'POST', headers, body: formData })
  if (res.status === 401) {
    sessionStorage.clear()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  return res.json()
}
