'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useSocket } from './useSocket'

interface LiveTranslateOptions {
  roomId: number
  token: string | null
  socket: ReturnType<typeof useSocket>['socket']
  userLangPref: string
  onSubtitle: (data: { userId: number; text: string; translated: string; isFinal: boolean; targetLang: string }) => void
}

export function useLiveTranslate({ roomId, token, socket, userLangPref, onSubtitle }: LiveTranslateOptions) {
  const [enabled, setEnabled] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const enabledRef = useRef(false)

  const startCapture = useCallback(async () => {
    if (!token) return false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        if (!enabledRef.current) return // Don't process if disabled
        
        const chunks = audioChunksRef.current
        audioChunksRef.current = []

        if (chunks.length === 0) return

        const audioBlob = new Blob(chunks, { type: 'audio/webm' })
        const reader = new FileReader()

        reader.onloadend = async () => {
          if (!enabledRef.current) return
          
          const base64data = reader.result as string
          const base64Audio = base64data.split(',')[1]

          try {
            const res = await fetch('/api/v1/translate-stream', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token,
              },
              body: JSON.stringify({
                audio: base64Audio,
                format: 'webm',
                target_lang: userLangPref,
              }),
            })

            if (!res.ok) {
              console.error('Translation API error:', res.status)
              return
            }

            const reader = res.body?.getReader()
            if (!reader) return

            const decoder = new TextDecoder()
            let translatedText = ''

            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const text = decoder.decode(value, { stream: true })
              const lines = text.split('\n')

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim()
                  if (data === '[DONE]') continue

                  try {
                    const json = JSON.parse(data)
                    if (json.text) {
                      translatedText += json.text
                    }
                  } catch {
                    // Skip
                  }
                }
              }
            }

            if (translatedText && enabledRef.current) {
              onSubtitle({
                userId: 0,
                text: '',
                translated: translatedText,
                isFinal: true,
                targetLang: userLangPref,
              })

              socket?.emit('subtitle:stream', {
                room_id: roomId,
                text_translated: translatedText,
                target_lang: userLangPref,
                is_final: true,
              })
            }
          } catch (err) {
            console.error('Translation error:', err)
          }
        }

        reader.readAsDataURL(audioBlob)
      }

      mediaRecorder.start(100)
      intervalRef.current = setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop()
          mediaRecorder.start(100)
        }
      }, 3000)

      setIsTranslating(false)
      return true
    } catch (err) {
      console.error('Failed to start audio capture:', err)
      setIsTranslating(false)
      return false
    }
  }, [token, roomId, socket, userLangPref, onSubtitle])

  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop()
      } catch {}
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    mediaRecorderRef.current = null
    audioChunksRef.current = []
    setIsTranslating(false)
  }, [])

  const toggle = useCallback(async () => {
    if (enabledRef.current) {
      // Stop
      enabledRef.current = false
      stopCapture()
      setEnabled(false)
    } else {
      // Start
      setIsTranslating(true)
      enabledRef.current = true
      setEnabled(true)
      const success = await startCapture()
      if (!success) {
        enabledRef.current = false
        setEnabled(false)
      }
    }
  }, [startCapture, stopCapture])

  useEffect(() => {
    return () => {
      enabledRef.current = false
      stopCapture()
    }
  }, [stopCapture])

  return {
    enabled,
    isTranslating,
    toggle,
    startCapture,
    stopCapture,
  }
}
