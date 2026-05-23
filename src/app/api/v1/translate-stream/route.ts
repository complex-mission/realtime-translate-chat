import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { errResponse } from '@/lib/errors'
import { emitToRoom } from '@/socket'
import { execute } from '@/lib/db'

// Supported languages for translation
const SUPPORTED_LANGUAGES = ['zh', 'en', 'ja']

/**
 * Call DashScope LiveTranslate API with streaming
 */
async function translateAudio(
  audio: string,
  format: string,
  targetLang: string,
  sourceLang?: string,
  apiKey?: string
): Promise<{ lang: string; text: string; error: boolean; errorDetail?: string }> {
  const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  
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

  const translationOptions: Record<string, string> = { target_lang: targetLang }
  if (sourceLang && sourceLang !== 'auto') {
    translationOptions.source_lang = sourceLang
  }

  try {
    console.log(`[Translation] Calling DashScope for ${targetLang}, format: ${format}, audio length: ${audio.length}`)
    
    const response = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.QWEN_LIVE_TRANSLATE_MODEL || 'qwen3-livetranslate-flash',
        messages,
        modalities: ['text'],
        stream: true,
        stream_options: { include_usage: true },
        translation_options: translationOptions,
      }),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      console.error(`[Translation] API error for ${targetLang}: status=${response.status}, body=${errBody}`)
      return { lang: targetLang, text: '', error: true, errorDetail: `API error ${response.status}: ${errBody.substring(0, 200)}` }
    }

    const reader = response.body?.getReader()
    if (!reader) {
      console.error(`[Translation] No response body for ${targetLang}`)
      return { lang: targetLang, text: '', error: true, errorDetail: 'No response body' }
    }

    // Read raw response for debugging
    const decoder = new TextDecoder()
    let rawResponse = ''
    let fullText = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      rawResponse += chunk
      
      // Parse SSE lines
      const lines = chunk.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue
        
        try {
          const json = JSON.parse(data)
          const content = json.choices?.[0]?.delta?.content || ''
          if (content) {
            fullText += content
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
    
    console.log(`[Translation] ${targetLang} raw response length: ${rawResponse.length}`)
    console.log(`[Translation] ${targetLang} extracted text:`, fullText || '(empty)')
    
    if (!fullText) {
      // Log first 500 chars of raw response for debugging
      console.log(`[Translation] ${targetLang} raw response preview:`, rawResponse.substring(0, 500))
      return { 
        lang: targetLang, 
        text: '', 
        error: true, 
        errorDetail: `Empty translation result. Raw response: ${rawResponse.substring(0, 300)}` 
      }
    }
    
    return { lang: targetLang, text: fullText, error: false }
  } catch (err: any) {
    console.error(`[Translation] Error for ${targetLang}:`, err)
    return { lang: targetLang, text: '', error: true, errorDetail: err.message || 'Unknown error' }
  }
}

export async function POST(req: NextRequest) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')

  const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY
  if (!DASHSCOPE_API_KEY) {
    console.error('[Translation] DASHSCOPE_API_KEY not configured')
    return Response.json({ success: false, error: { message: 'Translation service not configured' } }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { audio, format = 'wav', source_lang, room_id, user_id, call_session_id } = body

    if (!audio) {
      return Response.json({ success: false, error: { message: 'Missing audio data' } }, { status: 400 })
    }

    console.log('[Translation] Request received:', {
      audioLength: audio.length,
      format,
      source_lang,
      room_id,
      user_id,
      call_session_id
    })

    // Translate to all supported languages concurrently
    const translationPromises = SUPPORTED_LANGUAGES.map(target_lang =>
      translateAudio(audio, format, target_lang, source_lang, DASHSCOPE_API_KEY)
    )

    // Wait for all translations to complete
    const results = await Promise.all(translationPromises)

    // Build translations object
    const translations: Record<string, string> = {}
    const errors: string[] = []
    results.forEach(({ lang, text, error, errorDetail }) => {
      if (text) translations[lang] = text
      if (error && errorDetail) {
        errors.push(`${lang}: ${errorDetail}`)
        console.warn(`[Translation] ${lang} failed: ${errorDetail}`)
      }
    })
    console.log('[Translation] Final translations:', Object.keys(translations).length > 0 ? translations : '(all failed)')

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
        errors.push(`DB error: ${dbErr}`)
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
      success: Object.keys(translations).length > 0,
      data: { translations },
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (err: any) {
    console.error('[Translation] Error:', err)
    return Response.json(
      { success: false, error: { message: err.message || 'Internal error' } },
      { status: 500 }
    )
  }
}
