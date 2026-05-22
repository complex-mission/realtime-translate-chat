import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { errResponse } from '@/lib/errors'
import { getTextTranslationStream } from '@/lib/translate'
import { checkApiRateLimit } from '@/lib/ratelimit'
import redis from '@/lib/redis'
import type { LangCode } from '@/types'

export async function POST(req: NextRequest) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
  const rate = await checkApiRateLimit(u, ip, 'translate')
  if (!rate.allowed) return errResponse('TRANS_RATE')

  const { message_id, target_lang } = await req.json()
  if (!message_id || !target_lang) return errResponse('SYS_PARAM')
  if (!['zh', 'en', 'ja'].includes(target_lang)) return errResponse('TRANS_LANG_INVALID')

  const msg = await queryOne<any>('SELECT * FROM messages WHERE id=?', [message_id])
  if (!msg) return errResponse('MSG_NOT_FOUND')
  if (msg.msg_type !== 'text' && msg.msg_type !== 'voice_transcript') return errResponse('TRANS_LANG_INVALID')

  const ck = 'trans:text:' + message_id + ':' + target_lang
  const cached = await redis.get(ck)
  if (cached) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: cached, done: true })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    })
  }

  try {
    const response = await getTextTranslationStream(msg.content, target_lang as LangCode, msg.room_id)

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) { controller.close(); return }

        const decoder = new TextDecoder()
        let buffer = ''
        let fullText = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') {
                  if (fullText) {
                    await redis.setex(ck, 86400, fullText)
                    await execute(
                      'INSERT INTO translations (message_id,target_lang,translated,model) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE translated=VALUES(translated)',
                      [message_id, target_lang, fullText, process.env.QWEN_TEXT_MODEL || 'qwen3.5-plus']
                    )
                  }
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  continue
                }

                try {
                  const json = JSON.parse(data)
                  const content = json.choices?.[0]?.delta?.content || ''
                  if (content) {
                    fullText += content
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`))
                  }
                } catch {}
              }
            }
          }
        } catch (err) {
          console.error('Stream error:', err)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    })
  } catch {
    return errResponse('TRANS_TIMEOUT')
  }
}
