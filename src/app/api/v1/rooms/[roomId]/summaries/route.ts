import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { query, queryOne, execute } from '@/lib/db'
import redis from '@/lib/redis'
import { errResponse, okResponse } from '@/lib/errors'
import { genSummary } from '@/lib/translate'
import type { LangCode } from '@/types'
export async function POST(req: NextRequest, {params}:{params:Promise<{roomId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const rid = parseInt((await params).roomId)
  const room = await queryOne('SELECT * FROM rooms WHERE id=?',[rid]); if(!room) return errResponse('ROOM_NOT_FOUND')
  const rk = 'rl:summary:'+u.id; const c = await redis.incr(rk); if(c===1) await redis.expire(rk,60); if(c>3) return errResponse('TRANS_RATE')
  const body = await req.json().catch(()=>({}))
  let sql='SELECT m.msg_type,m.content,m.created_at,u.nickname as sender_nickname FROM messages m JOIN users u ON m.sender_id=u.id WHERE m.room_id=? AND m.msg_type IN ("text","voice_transcript","system")'
  const p:any[]=[rid]
  if(body.time_range_start){sql+=' AND m.created_at>=?';p.push(body.time_range_start)}
  if(body.time_range_end){sql+=' AND m.created_at<=?';p.push(body.time_range_end)}
  sql+=' ORDER BY m.created_at ASC'
  const msgs = await query(sql,p); if(!msgs.length) return errResponse('SUMMARY_NO_MSG')
  const last = await queryOne<{id:number}>('SELECT id FROM messages WHERE room_id=? ORDER BY id DESC LIMIT 1',[rid])
  const ck = 'summary:'+rid+':'+u.lang_pref+':'+(last?.id||0)
  const cached = await redis.get(ck); if(cached) return okResponse({content:cached,from_cache:true})
  try {
    const content = await genSummary(msgs as any, u.lang_pref as LangCode)
    const r = await execute('INSERT INTO meeting_summaries (room_id,triggered_by,lang,time_range_start,time_range_end,last_msg_id,content,model) VALUES (?,?,?,?,?,?,?,?)',[rid,u.id,u.lang_pref,body.time_range_start||null,body.time_range_end||null,last?.id||0,content,process.env.QWEN_TEXT_MODEL||'qwen3.5-plus'])
    await redis.setex(ck,86400,content)
    return okResponse({id:r.insertId,content,from_cache:false})
  } catch { return errResponse('SUMMARY_FAILED') }
}
export async function GET(req: NextRequest, {params}:{params:Promise<{roomId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const rid = parseInt((await params).roomId)
  return okResponse(await query('SELECT ms.*,u.nickname as triggered_by_nickname FROM meeting_summaries ms JOIN users u ON ms.triggered_by=u.id WHERE ms.room_id=? ORDER BY ms.created_at DESC',[rid]))
}
