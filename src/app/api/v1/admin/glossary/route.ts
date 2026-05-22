import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { query, execute } from '@/lib/db'
import redis from '@/lib/redis'
import { errResponse, okResponse } from '@/lib/errors'
export async function GET(req: NextRequest) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  if(u.role!=='admin') return errResponse('USER_NO_PERM')
  return okResponse(await query("SELECT * FROM glossaries WHERE scope='global' ORDER BY created_at DESC"))
}
export async function POST(req: NextRequest) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  if(u.role!=='admin') return errResponse('USER_NO_PERM')
  const {term_zh,term_en,term_ja,note} = await req.json()
  if(!term_zh&&!term_en&&!term_ja) return errResponse('GLOSSARY_EMPTY')
  const r = await execute("INSERT INTO glossaries (scope,term_zh,term_en,term_ja,note,created_by) VALUES ('global',?,?,?,?,?)",[term_zh||null,term_en||null,term_ja||null,note||null,u.id])
  await redis.del('glossary:global'); return okResponse({id:r.insertId},201)
}
