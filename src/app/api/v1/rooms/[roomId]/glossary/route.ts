import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { query, queryOne, execute } from '@/lib/db'
import redis from '@/lib/redis'
import { errResponse, okResponse } from '@/lib/errors'
export async function GET(req: NextRequest, {params}:{params:Promise<{roomId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const rid = parseInt((await params).roomId)
  return okResponse(await query("SELECT * FROM glossaries WHERE scope='room' AND room_id=?",[rid]))
}
export async function POST(req: NextRequest, {params}:{params:Promise<{roomId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const rid = parseInt((await params).roomId)
  if(u.role!=='admin'){const m=await queryOne<any>('SELECT * FROM room_members WHERE room_id=? AND user_id=?',[rid,u.id]);if(!m||m.role!=='leader')return errResponse('GLOSSARY_EMPTY')}
  const {term_zh,term_en,term_ja,note} = await req.json()
  if(!term_zh&&!term_en&&!term_ja) return errResponse('GLOSSARY_EMPTY')
  const r = await execute("INSERT INTO glossaries (scope,room_id,term_zh,term_en,term_ja,note,created_by) VALUES ('room',?,?,?,?,?,?)",[rid,term_zh||null,term_en||null,term_ja||null,note||null,u.id])
  await redis.del('glossary:room:'+rid); return okResponse({id:r.insertId},201)
}
