import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { errResponse } from '@/lib/errors'
import { emitToRoom } from '@/socket'
import { execute } from '@/lib/db'

// Supported languages for translation
const SUPPORTED_LANGUAGES = ['zh', 'en', 'ja']

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
    const { audio, format = 'wav', source_lang, room_id, user_id, call_session_id } = body

    if (!audio) {
      return Response.json({ success: false, error: { message: 'Missing audio data' } }, { status: 400 })
    }

    // Translate to all supported languages concurrently
    const translationPromises = SUPPORTED_LANGUAGES.map(async (target_lang) => {
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

      const translationOptions: any = { target_lang }
      if (source_lang) translationOptions.source_lang = source_lang

      try {
        const response = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: process.env.QWEN_LIVE_TRANSLATE_MODEL || 'qwen3-livetranslate-flash-2025-12-01',
            messages,
            modalities: ['text'],
            stream: false, // Non-streaming for batch processing
            translation_options: translationOptions,
          }),
        })

        if (!response.ok) {
          console.error(`Translation API error for ${target_lang}:`, response.status)
          return { lang: target_lang, text: '', error: true }
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ''
        return { lang: target_lang, text: content, error: false }
      } catch (err) {
        console.error(`Translation error for ${target_lang}:`, err)
        return { lang: target_lang, text: '', error: true }
      }
    })

    // Wait for all translations to complete
    const results = await Promise.all(translationPromises)

    // Build translations object
    const translations: Record<string, string> = {}
    results.forEach(({ lang, text }) => {
      if (text) translations[lang] = text
    })

    // Save to database
    if (room_id && Object.keys(translations).length > 0) {
      try {
        await execute(
          `INSERT INTO live_translations (room_id, call_session_id, user_id, source_lang, text_zh, text_en, text_ja) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            room_id,
            call_session_id || null,
            user_id || u.id,
            source_lang || null,
            translations['zh'] || null,
            translations['en'] || null,
            translations['ja'] || null
          ]
        )
        console.log('[Translation] Saved to database')
      } catch (dbErr) {
        console.error('[Translation] Failed to save to database:', dbErr)
      }
    }

    // Broadcast translations to room via socket
    if (room_id && Object.keys(translations).length > 0) {
      emitToRoom(room_id, 'subtitle:stream', {
        user_id: user_id || u.id,
        translations,
        is_final: true,
        timestamp: Date.now()
      })
      console.log('[Translation] Broadcasted to room:', room_id)
    }

    return Response.json({
      success: true,
      data: { translations }
    })
  } catch (err: any) {
    console.error('Translation error:', err)
    return Response.json(
      { success: false, error: { message: err.message || 'Internal error' } },
      { status: 500 }
    )
  }
}
