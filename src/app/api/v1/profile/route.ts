import { NextRequest } from 'next/server'
import { getUser, signAccessToken, genJti, track } from '@/lib/auth'
import { execute, queryOne } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
import { signURL } from '@/lib/url-sign'
import type { User } from '@/types'

export async function GET(req: NextRequest) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')
  return okResponse({
    id: u.id, username: u.username, nickname: u.nickname,
    avatar_url: signURL(u.avatar_url),
    department: u.department, lang_pref: u.lang_pref, role: u.role,
  })
}

export async function PATCH(req: NextRequest) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')
  const body = await req.json()
  const f: string[] = [], v: any[] = []
  for (const k of ['nickname', 'department', 'lang_pref']) {
    if (body[k] !== undefined) { f.push(k + '=?'); v.push(body[k]) }
  }
  if (!f.length) return errResponse('SYS_PARAM')
  v.push(u.id); await execute('UPDATE users SET ' + f.join(',') + ' WHERE id=?', v)

  const fresh = await queryOne<User>('SELECT * FROM users WHERE id=?', [u.id])
  if (!fresh) return errResponse('USER_NOT_FOUND')

  const jti = genJti()
  const at = signAccessToken(fresh, jti)
  await track(u.id, jti)

  return okResponse({ message: '已更新', access_token: at })
}
