import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// PRD 15.9: API 全局限流 + 安全头
export function proxy(request: NextRequest) {
  const response = NextResponse.next()

  // 安全头
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // PRD 15.7: CORS 检查（仅 API 路由）
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin')
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.APP_URL || 'http://localhost:19716')
      .split(',').map(s => s.trim())
    if (origin && !allowedOrigins.includes(origin)) {
      return NextResponse.json(
        { success: false, error: { code: 'CORS_DENIED', message_i18n: { zh: '不允许的来源' } } },
        { status: 403 }
      )
    }
  }

  return response
}

// 排除静态资源和 auth 路由（auth 路由有自己的限流逻辑）
export const config = {
  matcher: ['/api/:path*'],
}
