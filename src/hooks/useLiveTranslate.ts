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
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const enabledRef = useRef(false)
  const remoteAudioStreamRef = useRef<MediaStream | null>(null)

  const startCapture = useCallback(async (remoteAudioTrack?: any) => {
    if (!token) {
      console.log('[LiveTranslate] No token, cannot start')
      return false
    }

    try {
      let stream: MediaStream
      
      if (remoteAudioTrack) {
        console.log('[LiveTranslate] Using remote audio track:', remoteAudioTrack)
        const mediaStreamTrack = remoteAudioTrack.getMediaStreamTrack ? remoteAudioTrack.getMediaStreamTrack() : remoteAudioTrack
        stream = new MediaStream([mediaStreamTrack])
        remoteAudioStreamRef.current = stream
      } else {
        console.log('[LiveTranslate] No remote audio track, using local microphone')
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        remoteAudioStreamRef.current = stream
      }

      console.log('[LiveTranslate] Audio stream created, starting MediaRecorder')
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
        if (!enabledRef.current) {
          console.log('[LiveTranslate] Not enabled, skipping translation')
          return
        }
        
        const chunks = audioChunksRef.current
        audioChunksRef.current = []

        if (chunks.length === 0) {
          console.log('[LiveTranslate] No audio chunks, skipping')
          return
        }

        console.log('[LiveTranslate] Got', chunks.length, 'audio chunks, starting translation')
        const audioBlob = new Blob(chunks, { type: 'audio/webm' })
        const reader = new FileReader()

        reader.onloadend = async () => {
          if (!enabledRef.current) {
            console.log('[LiveTranslate] Not enabled after read, skipping')
            return
          }
          
          const base64data = reader.result as string
          const base64Audio = base64data.split(',')[1]
          console.log('[LiveTranslate] Audio encoded, calling translation API...')

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
                source_lang: 'auto',
                room_id: roomId,
                user_id: 0 // System translation
              }),
            })

            if (!res.ok) {
              console.error('[LiveTranslate] Translation API error:', res.status)
              return
            }

            const data = await res.json()
            console.log('[LiveTranslate] Translation result:', data)

            if (data.success && data.data?.translations) {
              // Get translation for user's language preference
              const translatedText = data.data.translations[userLangPref] || 
                                     data.data.translations['zh'] || 
                                     Object.values(data.data.translations)[0]

              if (translatedText) {
                console.log('[LiveTranslate] Translation complete:', translatedText)
                onSubtitle({
                  userId: 0,
                  text: '',
                  translated: translatedText as string,
                  isFinal: true,
                  targetLang: userLangPref,
                })
              }
            }
          } catch (err) {
            console.error('[LiveTranslate] Translation error:', err)
          }
        }

        reader.readAsDataURL(audioBlob)
      }

      mediaRecorder.start(100)
      console.log('[LiveTranslate] MediaRecorder started')
      intervalRef.current = setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop()
          mediaRecorder.start(100)
        }
      }, 3000)

      setIsTranslating(false)
      return true
    } catch (err) {
      console.error('[LiveTranslate] Failed to start audio capture:', err)
      setIsTranslating(false)
      return false
    }
  }, [token, roomId, userLangPref, onSubtitle])

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

    if (remoteAudioStreamRef.current) {
      remoteAudioStreamRef.current.getTracks().forEach((track) => track.stop())
      remoteAudioStreamRef.current = null
    }

    mediaRecorderRef.current = null
    audioChunksRef.current = []
    setIsTranslating(false)
  }, [])

  const toggle = useCallback(async (remoteAudioTrack?: any) => {
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
      const success = await startCapture(remoteAudioTrack)
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
