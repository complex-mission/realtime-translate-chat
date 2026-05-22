import { getSignedURL, isOSSConfigured } from './oss'

/**
 * 刷新单个 URL 的签名
 * 本地路径 / http(s) URL 直接返回，OSS key 重新签名
 */
export function signURL(url: string | null | undefined): string | null {
  if (!url) return null
  if (!isOSSConfigured()) return url
  // 已经是完整URL或本地路径，直接返回
  if (url.startsWith('/') || url.startsWith('http')) return url
  // OSS key -> 签名 URL
  return getSignedURL(url, 86400)
}

/**
 * 刷新对象中所有 avatar_url 字段的签名
 */
export function signAvatars<T extends { avatar_url?: string | null }>(items: T[]): T[] {
  return items.map(item => ({
    ...item,
    avatar_url: signURL(item.avatar_url) ?? item.avatar_url,
  }))
}
