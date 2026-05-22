// PRD 15.7: 传输安全 - Cookie 配置根据环境动态调整
// 生产环境: Secure + SameSite=Strict + HttpOnly
// 开发环境: SameSite=Lax + HttpOnly (不设 Secure，否则 HTTP 下不生效)

const isProd = process.env.NODE_ENV === 'production'

export function getRefreshTokenCookie(token: string): string {
  const parts = [
    'refresh_token=' + token,
    'HttpOnly',
    'Path=/',
    'Max-Age=604800', // 7天 (PRD 15.3)
  ]

  if (isProd) {
    // 生产环境: HTTPS 必须开启
    parts.push('Secure')
    parts.push('SameSite=Strict') // PRD 15.7: 防 CSRF
  } else {
    // 开发环境: HTTP 下不能设 Secure，用 Lax 兼容
    parts.push('SameSite=Lax')
  }

  return parts.join('; ')
}

export function getClearRefreshTokenCookie(): string {
  const parts = [
    'refresh_token=',
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
  ]

  if (isProd) {
    parts.push('Secure')
    parts.push('SameSite=Strict')
  } else {
    parts.push('SameSite=Lax')
  }

  return parts.join('; ')
}
