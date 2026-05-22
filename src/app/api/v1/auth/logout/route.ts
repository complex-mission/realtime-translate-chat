import { NextRequest } from 'next/server'
import { verifyAccess, revoke } from '@/lib/auth'
import { errResponse, okResponse } from '@/lib/errors'
import { getClearRefreshTokenCookie } from '@/lib/cookies'

export async function POST(req: NextRequest) {
  const h = req.headers.get('authorization')
  if (!h?.startsWith('Bearer ')) return errResponse('AUTH_TOKEN_INVALID')

  const p = verifyAccess(h.slice(7))
  if (p) {
    // PRD 15.5: 吊销当前 token
    const remainingTtl = Math.max(p.exp - Math.floor(Date.now() / 1000), 60)
    await revoke(p.jti, remainingTtl)
  }

  const r = okResponse({ message: '已登出' })
  r.headers.set('Set-Cookie', getClearRefreshTokenCookie())
  return r
}
