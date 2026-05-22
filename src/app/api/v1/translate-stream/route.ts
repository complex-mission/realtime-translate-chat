import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { errResponse } from '@/lib/errors'

export async function POST(req: NextRequest) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')

  const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY
  if (!DASHSCOPE_API_KEY) {
    console.error('DASHSCOPE_API_KEY not configured')
    return Response.json({ success: false, error: { message: 'Translation service not configured' } }, { status: 500 })
  }

  const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

  try {
    const body = await req.json()
    const { audio, format = 'wav', source_lang, target_lang } = body

    if (!audio) {
      return Response.json({ success: false, error: { message: 'Missing audio data' } }, { status: 400 })
    }

    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: audio,
              format: format,
            },
          },
        ],
      },
    ]

    const translationOptions: any = {}
    if (source_lang) translationOptions.source_lang = source_lang
    if (target_lang) translationOptions.target_lang = target_lang

    const response = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen3-livetranslate-flash-2025-12-01',
        messages,
        modalities: ['text'],
        stream: true,
        stream_options: { include_usage: true },
        translation_options: translationOptions,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('DashScope API error:', response.status, errorText)
      return Response.json(
        { success: false, error: { message: `Translation API error: ${response.status}` } },
        { status: response.status }
      )
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) {
          controller.close()
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

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
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  continue
                }

                try {
                  const json = JSON.parse(data)
                  const content = json.choices?.[0]?.delta?.content || ''
                  if (content) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`)
                    )
                  }
                } catch {
                  // Skip invalid JSON
                }
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
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err: any) {
    console.error('Translation error:', err)
    return Response.json(
      { success: false, error: { message: err.message || 'Internal error' } },
      { status: 500 }
    )
  }
}
