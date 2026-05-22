import redis from './redis'
import { query } from './db'
import type { LangCode, Glossary } from '@/types'

function getKey() { return process.env.DASHSCOPE_API_KEY || '' }
function getModel() { return process.env.QWEN_TEXT_MODEL || 'qwen3.5-plus' }

export async function getTextTranslation(msgId: number, content: string, lang: LangCode, roomId?: number) {
  const ck = 'trans:text:'+msgId+':'+lang
  const cached = await redis.get(ck); if (cached) return cached
  const g = await loadGlossary(roomId)
  const gp = g.length ? '\n术语:'+g.map(t=>(t.term_zh||'')+'/'+(t.term_en||'')+'/'+(t.term_ja||'')).join(', ') : ''
  const ln: Record<string,string> = { zh:'中文', en:'English', ja:'日本語' }
  const r = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getKey()},
    body: JSON.stringify({model:getModel(), messages:[{role:'user',content:'翻译为'+ln[lang]+'，只输出译文。'+gp+'\n\n'+content}], max_tokens:4096, temperature:0.3, enable_thinking: false}),
  })
  if (!r.ok) throw new Error('API '+r.status)
  const d = await r.json(), t = d.choices?.[0]?.message?.content?.trim()||''
  if (t) await redis.setex(ck, 86400, t); return t
}

export async function getTextTranslationStream(content: string, lang: LangCode, roomId?: number) {
  const g = await loadGlossary(roomId)
  const gp = g.length ? '\n术语:'+g.map(t=>(t.term_zh||'')+'/'+(t.term_en||'')+'/'+(t.term_ja||'')).join(', ') : ''
  const ln: Record<string,string> = { zh:'中文', en:'English', ja:'日本語' }
  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getKey()},
    body: JSON.stringify({
      model:getModel(),
      messages:[{role:'user',content:'翻译为'+ln[lang]+'，只输出译文。'+gp+'\n\n'+content}],
      max_tokens:4096,
      temperature:0.3,
      stream: true,
      stream_options: { include_usage: true },
      enable_thinking: false,
    }),
  })
  if (!response.ok) throw new Error('API '+response.status)
  return response
}

async function loadGlossary(roomId?: number): Promise<Glossary[]> {
  const ck = 'glossary:' + (roomId || 'global')
  const cached = await redis.get(ck)
  if (cached) return JSON.parse(cached)
  const gl = await query<Glossary>("SELECT * FROM glossaries WHERE scope='global'")
  const rl = roomId ? await query<Glossary>("SELECT * FROM glossaries WHERE scope='room' AND room_id=?", [roomId]) : []
  const s = new Set<string>(); const result = [...rl,...gl].filter(t=>{const k=t.term_zh||t.term_en||t.term_ja||''; if(s.has(k))return false; s.add(k); return true})
  await redis.setex(ck, 3600, JSON.stringify(result))
  return result
}

export async function genSummary(msgs: any[], lang: LangCode) {
  const ln: Record<string,string> = { zh:'中文', en:'English', ja:'日本語' }
  const tl = msgs.map(m=>new Date(m.created_at).toLocaleString('zh-CN')+' ['+(m.sender_nickname||'系统')+']: '+m.content).join('\n')
  const r = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getKey()},
    body: JSON.stringify({model:getModel(), messages:[{role:'user',content:'根据聊天记录生成会议纪要('+ln[lang]+')。结构：1.主题 2.参会者 3.时间 4.讨论 5.决策 6.待办 7.风险\n\n'+tl}], max_tokens:8192, temperature:0.5}),
  })
  if (!r.ok) throw new Error('Summary API error')
  const d = await r.json(); return d.choices?.[0]?.message?.content?.trim()||''
}
