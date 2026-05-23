'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useSocket } from './useSocket'

interface LiveTranslateOptions {
  roomId: number
  token: string | null
  socket: ReturnType<typeof useSocket>['socket']
  userLangPref: string
  userId: number
  onSubtitle: (data: { userId: number; text: string; translated: string; isFinal: boolean; targetLang: string }) => void
}

export interface DebugInfo {
  status: string
  audioSource: string
  lastError: string
  lastApiCall: string
  lastApiResult: string
  chunksReceived: number
  lastChunkSize: number
  audioLevel: number
  silenceDetected: boolean
}

// Smart timing constants for meeting scenarios
const MIN_RECORD_MS = 3000    // Minimum 3s before translating
const MAX_RECORD_MS = 8000    // Maximum 8s before forcing translation
const SILENCE_THRESHOLD = 0.02 // Audio level below this = silence
const SILENCE_DURATION = 1500  // 1.5s of silence triggers translation

export function useLiveTranslate({ roomId, token, socket, userLangPref, userId, onSubtitle }: LiveTranslateOptions) {
  const [enabled, setEnabled] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    status: 'idle',
    audioSource: 'none',
    lastError: '',
    lastApiCall: '',
    lastApiResult: '',
    chunksReceived: 0,
    lastChunkSize: 0,
    audioLevel: 0,
    silenceDetected: false,
  })
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const silenceCheckRef = useRef<NodeJS.Timeout | null>(null)
  const enabledRef = useRef(false)
  const remoteAudioStreamRef = useRef<MediaStream | null>(null)
  const chunksCountRef = useRef(0)
  const recordingStartTimeRef = useRef<number>(0)
  const lastSpeechTimeRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)

  const updateDebug = useCallback((updates: Partial<DebugInfo>) => {
    setDebugInfo(prev => ({ ...prev, ...updates }))
  }, [])

  const startCapture = useCallback(async (remoteAudioTrack?: any) => {
    if (!token) {
      updateDebug({ lastError: 'No token' })
      return false
    }

    try {
      let stream: MediaStream
      let audioSource = 'local mic'
      
      if (remoteAudioTrack) {
        updateDebug({ status: 'checking remote audio track...' })
        
        // Try to get MediaStreamTrack from remote audio track
        let mediaStreamTrack: MediaStreamTrack | null = null
        
        if (typeof remoteAudioTrack.getMediaStreamTrack === 'function') {
          try {
            mediaStreamTrack = remoteAudioTrack.getMediaStreamTrack()
            audioSource = 'remote (getMediaStreamTrack)'
          } catch (e) {
            console.log('[LiveTranslate] getMediaStreamTrack() failed:', e)
          }
        }
        
        if (!mediaStreamTrack && remoteAudioTrack instanceof MediaStreamTrack) {
          mediaStreamTrack = remoteAudioTrack
          audioSource = 'remote (MediaStreamTrack)'
        }
        
        if (!mediaStreamTrack && remoteAudioTrack._mediaStreamTrack) {
          mediaStreamTrack = remoteAudioTrack._mediaStreamTrack
          audioSource = 'remote (_mediaStreamTrack)'
        }
        
        if (!mediaStreamTrack && remoteAudioTrack._track) {
          mediaStreamTrack = remoteAudioTrack._track
          audioSource = 'remote (_track)'
        }
        
        if (!mediaStreamTrack && remoteAudioTrack.mediaStreamTrack) {
          mediaStreamTrack = remoteAudioTrack.mediaStreamTrack
          audioSource = 'remote (mediaStreamTrack)'
        }
        
        // Look for any property that looks like a MediaStreamTrack
        if (!mediaStreamTrack) {
          for (const key of Object.keys(remoteAudioTrack)) {
            const val = remoteAudioTrack[key]
            if (val && typeof val === 'object' && typeof val.getSettings === 'function') {
              mediaStreamTrack = val
              audioSource = `remote (property: ${key})`
              break
            }
          }
        }
        
        if (mediaStreamTrack) {
          stream = new MediaStream([mediaStreamTrack])
          remoteAudioStreamRef.current = stream
          updateDebug({ audioSource, status: 'remote track obtained' })
        } else {
          audioSource = 'local mic (remote track failed)'
          updateDebug({ audioSource, status: 'remote track failed, trying local mic...' })
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            remoteAudioStreamRef.current = stream
          } catch (micErr: any) {
            updateDebug({ lastError: 'No audio source: ' + micErr.message })
            return false
          }
        }
      } else {
        audioSource = 'local mic (no remote)'
        updateDebug({ audioSource, status: 'using local microphone' })
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          remoteAudioStreamRef.current = stream
        } catch (micErr: any) {
          updateDebug({ lastError: 'No microphone found: ' + micErr.message })
          return false
        }
      }

      // Set up audio analyser for silence detection
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      updateDebug({ status: 'creating MediaRecorder...' })
      const mimeType = 'audio/webm;codecs=opus'
      const supportedMime = MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'audio/ogg;codecs=opus'
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedMime })
      mediaRecorderRef.current = mediaRecorder

      // Function to get current audio level
      const getAudioLevel = (): number => {
        if (!analyserRef.current) return 0
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        return average / 255 // Normalize to 0-1
      }

      // Function to translate accumulated audio
      const translateAccumulatedAudio = async () => {
        if (!enabledRef.current) return
        
        const chunks = audioChunksRef.current
        audioChunksRef.current = []
        recordingStartTimeRef.current = Date.now()

        if (chunks.length === 0) {
          updateDebug({ status: 'no audio chunks, continuing...' })
          return
        }

        const audioBlob = new Blob(chunks, { type: mediaRecorder.mimeType })
        
        if (audioBlob.size < 500) {
          updateDebug({ status: 'audio too small: ' + audioBlob.size + ' bytes' })
          return
        }

        const duration = Date.now() - recordingStartTimeRef.current
        updateDebug({ status: `translating ${Math.round(duration/1000)}s audio...` })

        // Convert to base64
        const reader = new FileReader()
        reader.onloadend = async () => {
          if (!enabledRef.current) return
          
          const base64data = reader.result as string
          const base64Audio = base64data.split(',')[1]
          const format = mediaRecorder.mimeType.includes('webm') ? 'webm' : 'ogg'
          const dataUrl = `data:audio/${format};base64,${base64Audio}`
          
          updateDebug({ 
            lastApiCall: `${format} ${Math.round(duration/1000)}s, ${audioBlob.size}b`
          })

          try {
            const res = await fetch('/api/v1/translate-stream', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token,
              },
              body: JSON.stringify({
                audio: dataUrl,
                format: format,
                room_id: roomId,
              }),
            })

            const data = await res.json()
            
            updateDebug({ 
              lastApiResult: JSON.stringify(data).substring(0, 150),
              status: data.success ? 'translation received!' : 'api returned no translations'
            })

            if (data.success && data.data?.translations) {
              const translatedText = data.data.translations[userLangPref] || 
                                     data.data.translations['zh'] || 
                                     Object.values(data.data.translations)[0]

              if (translatedText) {
                onSubtitle({
                  userId: userId,
                  text: '',
                  translated: translatedText as string,
                  isFinal: true,
                  targetLang: userLangPref,
                })
              }
            }
          } catch (err: any) {
            updateDebug({ lastError: 'fetch error: ' + err.message })
          }
        }
        
        reader.readAsDataURL(audioBlob)
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          chunksCountRef.current++
          lastSpeechTimeRef.current = Date.now()
        }
      }

      // Start recording
      mediaRecorder.start(200) // Collect chunks every 200ms
      chunksCountRef.current = 0
      recordingStartTimeRef.current = Date.now()
      lastSpeechTimeRef.current = Date.now()
      
      updateDebug({ 
        status: 'recording... (smart timing)',
        lastError: '',
        chunksReceived: 0
      })

      // Smart timing: check audio level periodically
      silenceCheckRef.current = setInterval(() => {
        if (!enabledRef.current || mediaRecorder.state !== 'recording') return

        const audioLevel = getAudioLevel()
        const now = Date.now()
        const recordingDuration = now - recordingStartTimeRef.current
        const silenceDuration = now - lastSpeechTimeRef.current

        updateDebug({ 
          audioLevel: Math.round(audioLevel * 100) / 100,
          silenceDetected: audioLevel < SILENCE_THRESHOLD
        })

        // Update last speech time if audio detected
        if (audioLevel >= SILENCE_THRESHOLD) {
          lastSpeechTimeRef.current = now
        }

        // Decision: should we translate now?
        const shouldTranslate = 
          // Rule 1: Minimum recording time reached AND silence detected
          (recordingDuration >= MIN_RECORD_MS && silenceDuration >= SILENCE_DURATION) ||
          // Rule 2: Maximum recording time reached (even if still speaking)
          (recordingDuration >= MAX_RECORD_MS)

        if (shouldTranslate && audioChunksRef.current.length > 0) {
          updateDebug({ status: 'translating...' })
          
          // Stop and restart recorder
          mediaRecorder.stop()
          
          // Translate after a small delay to ensure all chunks are collected
          setTimeout(() => {
            translateAccumulatedAudio()
            // Restart recording
            if (enabledRef.current && mediaRecorder.state !== 'recording') {
              mediaRecorder.start(200)
              recordingStartTimeRef.current = Date.now()
              lastSpeechTimeRef.current = Date.now()
            }
          }, 100)
        }
      }, 200) // Check every 200ms

      setIsTranslating(false)
      return true
    } catch (err: any) {
      console.error('[LiveTranslate] Failed to start audio capture:', err)
      updateDebug({ lastError: 'start failed: ' + err.message })
      setIsTranslating(false)
      return false
    }
  }, [token, roomId, userLangPref, onSubtitle, updateDebug])

  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (silenceCheckRef.current) {
      clearInterval(silenceCheckRef.current)
      silenceCheckRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop()
      } catch {}
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close()
      } catch {}
      audioContextRef.current = null
    }

    if (remoteAudioStreamRef.current) {
      remoteAudioStreamRef.current.getTracks().forEach((track) => track.stop())
      remoteAudioStreamRef.current = null
    }

    mediaRecorderRef.current = null
    audioChunksRef.current = []
    analyserRef.current = null
    setIsTranslating(false)
    updateDebug({ status: 'stopped', audioLevel: 0, silenceDetected: false })
  }, [updateDebug])

  const toggle = useCallback(async (remoteAudioTrack?: any): Promise<boolean> => {
    if (enabledRef.current) {
      // Stop
      enabledRef.current = false
      stopCapture()
      setEnabled(false)
      return false
    } else {
      // Start
      setIsTranslating(true)
      const success = await startCapture(remoteAudioTrack)
      if (success) {
        enabledRef.current = true
        setEnabled(true)
      } else {
        setIsTranslating(false)
      }
      return success
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
    debugInfo,
    toggle,
    startCapture,
    stopCapture,
  }
}
