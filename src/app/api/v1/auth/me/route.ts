import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { errResponse, okResponse } from '@/lib/errors'
import { signURL } from '@/lib/url-sign'

export async function GET(req: NextRequest) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')
  return okResponse({
    id: u.id, username: u.username, nickname: u.nickname,
    avatar_url: signURL(u.avatar_url),
    department: u.department, lang_pref: u.lang_pref,
    role: u.role, must_change_pw: u.must_change_pw,
  })
}
