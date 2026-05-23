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

export interface DebugInfo {
  status: string
  audioSource: string
  lastError: string
  lastApiCall: string
  lastApiResult: string
  chunksReceived: number
  lastChunkSize: number
}

export function useLiveTranslate({ roomId, token, socket, userLangPref, onSubtitle }: LiveTranslateOptions) {
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
  })
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const enabledRef = useRef(false)
  const remoteAudioStreamRef = useRef<MediaStream | null>(null)
  const chunksCountRef = useRef(0)

  const updateDebug = useCallback((updates: Partial<DebugInfo>) => {
    setDebugInfo(prev => ({ ...prev, ...updates }))
  }, [])

  /**
   * Convert audio blob to WAV format using Web Audio API
   */
  const convertToWav = useCallback(async (audioBlob: Blob): Promise<ArrayBuffer | null> => {
    try {
      updateDebug({ status: 'converting to wav...' })
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      // Convert to WAV
      const numChannels = audioBuffer.numberOfChannels
      const sampleRate = audioBuffer.sampleRate
      const format = 1 // PCM
      const bitDepth = 16
      
      const bytesPerSample = bitDepth / 8
      const blockAlign = numChannels * bytesPerSample
      const dataSize = audioBuffer.length * blockAlign
      const bufferSize = 44 + dataSize
      
      const buffer = new ArrayBuffer(bufferSize)
      const view = new DataView(buffer)
      
      // WAV header
      writeString(view, 0, 'RIFF')
      view.setUint32(4, bufferSize - 8, true)
      writeString(view, 8, 'WAVE')
      writeString(view, 12, 'fmt ')
      view.setUint32(16, 16, true)
      view.setUint16(20, format, true)
      view.setUint16(22, numChannels, true)
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * blockAlign, true)
      view.setUint16(32, blockAlign, true)
      view.setUint16(34, bitDepth, true)
      writeString(view, 36, 'data')
      view.setUint32(40, dataSize, true)
      
      // Write audio data
      const channelData = []
      for (let i = 0; i < numChannels; i++) {
        channelData.push(audioBuffer.getChannelData(i))
      }
      
      let offset = 44
      for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, channelData[channel][i]))
          const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
          view.setInt16(offset, int16, true)
          offset += 2
        }
      }
      
      await audioContext.close()
      updateDebug({ status: 'wav converted, size: ' + bufferSize })
      return buffer
    } catch (err: any) {
      console.error('[LiveTranslate] Failed to convert to WAV:', err)
      updateDebug({ lastError: 'WAV convert failed: ' + err.message })
      return null
    }
  }, [updateDebug])

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
        console.log('[LiveTranslate] Remote audio track:', remoteAudioTrack)
        console.log('[LiveTranslate] Track type:', typeof remoteAudioTrack)
        console.log('[LiveTranslate] Track keys:', Object.keys(remoteAudioTrack || {}))
        console.log('[LiveTranslate] Track prototype:', Object.getPrototypeOf(remoteAudioTrack))
        
        // Try to get MediaStreamTrack from remote audio track
        let mediaStreamTrack: MediaStreamTrack | null = null
        
        // Method 1: getMediaStreamTrack()
        if (typeof remoteAudioTrack.getMediaStreamTrack === 'function') {
          try {
            mediaStreamTrack = remoteAudioTrack.getMediaStreamTrack()
            audioSource = 'remote (getMediaStreamTrack)'
            console.log('[LiveTranslate] Got track via getMediaStreamTrack():', mediaStreamTrack)
          } catch (e) {
            console.log('[LiveTranslate] getMediaStreamTrack() failed:', e)
          }
        }
        
        // Method 2: Direct MediaStreamTrack
        if (!mediaStreamTrack && remoteAudioTrack instanceof MediaStreamTrack) {
          mediaStreamTrack = remoteAudioTrack
          audioSource = 'remote (MediaStreamTrack)'
          console.log('[LiveTranslate] Track is MediaStreamTrack instance')
        }
        
        // Method 3: _mediaStreamTrack property
        if (!mediaStreamTrack && remoteAudioTrack._mediaStreamTrack) {
          mediaStreamTrack = remoteAudioTrack._mediaStreamTrack
          audioSource = 'remote (_mediaStreamTrack)'
          console.log('[LiveTranslate] Got track from _mediaStreamTrack:', mediaStreamTrack)
        }
        
        // Method 4: _track property
        if (!mediaStreamTrack && remoteAudioTrack._track) {
          mediaStreamTrack = remoteAudioTrack._track
          audioSource = 'remote (_track)'
          console.log('[LiveTranslate] Got track from _track:', mediaStreamTrack)
        }
        
        // Method 5: mediaStreamTrack property
        if (!mediaStreamTrack && remoteAudioTrack.mediaStreamTrack) {
          mediaStreamTrack = remoteAudioTrack.mediaStreamTrack
          audioSource = 'remote (mediaStreamTrack)'
          console.log('[LiveTranslate] Got track from mediaStreamTrack:', mediaStreamTrack)
        }
        
        // Method 6: Look for any property that looks like a MediaStreamTrack
        if (!mediaStreamTrack) {
          for (const key of Object.keys(remoteAudioTrack)) {
            const val = remoteAudioTrack[key]
            if (val && typeof val === 'object' && typeof val.getSettings === 'function') {
              mediaStreamTrack = val
              audioSource = `remote (property: ${key})`
              console.log(`[LiveTranslate] Found MediaStreamTrack in property '${key}':`, val)
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
          console.warn('[LiveTranslate] Could not extract MediaStreamTrack from remote audio track')
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            remoteAudioStreamRef.current = stream
          } catch (micErr: any) {
            updateDebug({ lastError: 'No audio source: remote track failed and no microphone (' + micErr.message + ')' })
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

      updateDebug({ status: 'creating MediaRecorder...' })
      const mimeType = 'audio/webm;codecs=opus'
      const supportedMime = MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'audio/ogg;codecs=opus'
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedMime })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          chunksCountRef.current++
          updateDebug({ 
            chunksReceived: chunksCountRef.current,
            lastChunkSize: event.data.size,
            status: 'recording... chunk #' + chunksCountRef.current
          })
        }
      }

      mediaRecorder.onstop = async () => {
        if (!enabledRef.current) {
          updateDebug({ status: 'stopped (not enabled)' })
          return
        }
        
        const chunks = audioChunksRef.current
        audioChunksRef.current = []

        if (chunks.length === 0) {
          updateDebug({ status: 'no audio chunks' })
          return
        }

        updateDebug({ status: 'got ' + chunks.length + ' chunks, processing...' })
        const audioBlob = new Blob(chunks, { type: mediaRecorder.mimeType })
        
        if (audioBlob.size < 1000) {
          updateDebug({ status: 'audio too small: ' + audioBlob.size + ' bytes' })
          return
        }

        // Convert to base64 with Data URL format
        const reader = new FileReader()
        reader.onloadend = async () => {
          if (!enabledRef.current) {
            updateDebug({ status: 'stopped (not enabled)' })
            return
          }
          
          const base64data = reader.result as string
          const base64Audio = base64data.split(',')[1]
          
          // Determine format from mimeType
          const format = mediaRecorder.mimeType.includes('webm') ? 'webm' : 'ogg'
          
          // Use Data URL format as required by DashScope API
          const dataUrl = `data:audio/${format};base64,${base64Audio}`
          
          updateDebug({ 
            status: 'calling API...',
            lastApiCall: format + ' size: ' + audioBlob.size + ', base64: ' + base64Audio.length
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
            console.log('[LiveTranslate] API response:', data)
            
            updateDebug({ 
              lastApiResult: JSON.stringify(data).substring(0, 200),
              status: data.success ? 'success' : 'api returned no translations'
            })

            if (!res.ok) {
              updateDebug({ lastError: 'API error: ' + res.status })
              return
            }

            if (data.success && data.data?.translations) {
              const translatedText = data.data.translations[userLangPref] || 
                                     data.data.translations['zh'] || 
                                     Object.values(data.data.translations)[0]

              if (translatedText) {
                updateDebug({ status: 'translation received!' })
                onSubtitle({
                  userId: 0,
                  text: '',
                  translated: translatedText as string,
                  isFinal: true,
                  targetLang: userLangPref,
                })
              } else {
                updateDebug({ lastError: 'no text in translations' })
              }
            } else {
              updateDebug({ lastError: 'no translations in response: ' + JSON.stringify(data).substring(0, 100) })
            }
          } catch (err: any) {
            console.error('[LiveTranslate] Translation request failed:', err)
            updateDebug({ lastError: 'fetch error: ' + err.message })
          }
        }
        
        reader.readAsDataURL(audioBlob)
      }

      mediaRecorder.start(100)
      chunksCountRef.current = 0
      updateDebug({ 
        status: 'MediaRecorder started',
        lastError: '',
        chunksReceived: 0
      })
      
      intervalRef.current = setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop()
          mediaRecorder.start(100)
        }
      }, 3000)

      setIsTranslating(false)
      return true
    } catch (err: any) {
      console.error('[LiveTranslate] Failed to start audio capture:', err)
      updateDebug({ lastError: 'start failed: ' + err.message })
      setIsTranslating(false)
      return false
    }
  }, [token, roomId, userLangPref, onSubtitle, convertToWav, updateDebug])

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
    updateDebug({ status: 'stopped' })
  }, [updateDebug])

  const toggle = useCallback(async (remoteAudioTrack?: any): Promise<boolean> => {
    if (enabledRef.current) {
      // Stop
      enabledRef.current = false
      stopCapture()
      setEnabled(false)
      return false
    } else {
      // Start - don't set enabled until capture succeeds
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

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
