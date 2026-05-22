import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
import { getTextTranslation } from '@/lib/translate'
import { checkApiRateLimit } from '@/lib/ratelimit'
import type { LangCode } from '@/types'

export async function POST(req: NextRequest) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')

  // PRD 15.9: 翻译接口 单用户每分钟最多60次
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
  const rate = await checkApiRateLimit(u, ip, 'translate')
  if (!rate.allowed) return errResponse('TRANS_RATE')

  const { message_id, target_lang } = await req.json()
  if (!message_id || !target_lang) return errResponse('SYS_PARAM')
  if (!['zh', 'en', 'ja'].includes(target_lang)) return errResponse('TRANS_LANG_INVALID')

  const msg = await queryOne<any>('SELECT * FROM messages WHERE id=?', [message_id])
  if (!msg) return errResponse('MSG_NOT_FOUND')
  if (msg.msg_type !== 'text' && msg.msg_type !== 'voice_transcript') return errResponse('TRANS_LANG_INVALID')

  try {
    const t = await getTextTranslation(message_id, msg.content, target_lang as LangCode, msg.room_id)
    await execute(
      'INSERT INTO translations (message_id,target_lang,translated,model) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE translated=VALUES(translated)',
      [message_id, target_lang, t, process.env.QWEN_TEXT_MODEL || 'qwen3.5-plus']
    )
    return okResponse({ message_id, target_lang, translated: t, from_cache: false })
  } catch { return errResponse('TRANS_TIMEOUT') }
}
