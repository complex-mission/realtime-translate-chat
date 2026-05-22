import { NextRequest } from 'next/server'
import { getUser, hashPassword } from '@/lib/auth'
import { query, execute } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
import { validatePassword } from '@/lib/utils'
import { signAvatars } from '@/lib/url-sign'

export async function GET(req: NextRequest) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')
  if (u.role !== 'admin') return errResponse('USER_NO_PERM')

  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const ps = parseInt(url.searchParams.get('page_size') || '20')
  const status = url.searchParams.get('status')
  const role = url.searchParams.get('role')

  let sql = 'SELECT id,username,nickname,avatar_url,department,lang_pref,role,status,must_change_pw,created_at FROM users WHERE 1=1'
  const p: any[] = []
  if (status) { sql += ' AND status=?'; p.push(status) }
  if (role) { sql += ' AND role=?'; p.push(role) }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  p.push(ps, (page - 1) * ps)

  const users = await query(sql, p)
  const total = await query('SELECT COUNT(*) as cnt FROM users')

  return okResponse({
    users: signAvatars(users), // 刷新头像签名
    total: total[0]?.cnt || 0, page, page_size: ps,
  })
}

export async function POST(req: NextRequest) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')
  if (u.role !== 'admin') return errResponse('USER_NO_PERM')

  const { username, password, nickname, department, lang_pref, role } = await req.json()
  if (!username || !password || !nickname) return errResponse('SYS_PARAM')

  const pe = validatePassword(password)
  if (pe) return errResponse('AUTH_PASSWORD_WEAK')

  if ((await query('SELECT 1 FROM users WHERE username=?', [username])).length)
    return errResponse('USER_DUPLICATE')

  const h = await hashPassword(password)
  const r = await execute(
    'INSERT INTO users (username,password_hash,nickname,department,lang_pref,role,must_change_pw) VALUES (?,?,?,?,?,?,TRUE)',
    [username, h, nickname, department || null, lang_pref || 'zh', role || 'member']
  )
  return okResponse({ id: r.insertId }, 201)
}
