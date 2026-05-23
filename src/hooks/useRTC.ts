'use client'
import { useRef, useState, useCallback, useEffect } from 'react'

interface RTCState {
  joined: boolean
  publishing: boolean
  localAudioTrack: any | null
  localVideoTrack: any | null
  remoteUsers: Map<string, { audioTrack: any; videoTrack: any; audioMuted: boolean; videoOff: boolean }>
}

interface UseRTCOptions {
  appId: string
  onUserPublished?: (userId: string, mediaType: 'audio' | 'video') => void
  onUserJoined?: (userId: string) => void
  onUserLeft?: (userId: string) => void
  onError?: (error: string) => void
}

export function useRTC(options: UseRTCOptions) {
  const clientRef = useRef<any>(null)
  const localAudioTrackRef = useRef<any>(null)
  const localVideoTrackRef = useRef<any>(null)
  const [state, setState] = useState<RTCState>({
    joined: false,
    publishing: false,
    localAudioTrack: null,
    localVideoTrack: null,
    remoteUsers: new Map(),
  })
  const [muted, setMuted] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [videoToggling, setVideoToggling] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [hasCamera, setHasCamera] = useState<boolean | null>(null)
  const [hasMic, setHasMic] = useState<boolean | null>(null)
  const DingRTCRef = useRef<any>(null)
  const mcuAudioSubscribed = useRef(false)
  const audioLevelInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('dingrtc').then((mod) => {
        DingRTCRef.current = mod.default || mod
        checkDevices()
      }).catch(err => {
        console.error('Failed to load dingrtc:', err)
      })

      navigator.mediaDevices?.addEventListener('devicechange', checkDevices)
    }
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', checkDevices)
      if (audioLevelInterval.current) {
        clearInterval(audioLevelInterval.current)
      }
      // Cleanup RTC resources on unmount
      if (localAudioTrackRef.current) {
        try { localAudioTrackRef.current.close() } catch {}
      }
      if (localVideoTrackRef.current) {
        try { localVideoTrackRef.current.close() } catch {}
      }
      if (clientRef.current) {
        try { clientRef.current.leave() } catch {}
      }
    }
  }, [])

  const checkDevices = useCallback(async () => {
    const DingRTC = DingRTCRef.current
    if (!DingRTC) return

    try {
      const cameras = await DingRTC.getCameras()
      setHasCamera(cameras.length > 0)
    } catch {
      setHasCamera(false)
    }

    try {
      const mics = await DingRTC.getMicrophones()
      setHasMic(mics.length > 0)
    } catch {
      setHasMic(false)
    }
  }, [])

  const startAudioLevelMonitor = useCallback(() => {
    if (audioLevelInterval.current) {
      clearInterval(audioLevelInterval.current)
    }
    audioLevelInterval.current = setInterval(() => {
      if (localAudioTrackRef.current) {
        try {
          const level = localAudioTrackRef.current.getVolumeLevel()
          setAudioLevel(level)
        } catch {
          setAudioLevel(0)
        }
      } else {
        setAudioLevel(0)
      }
    }, 200)
  }, [])

  const stopAudioLevelMonitor = useCallback(() => {
    if (audioLevelInterval.current) {
      clearInterval(audioLevelInterval.current)
      audioLevelInterval.current = null
    }
    setAudioLevel(0)
  }, [])

  const join = useCallback(async (channel: string, uid: string, token: string) => {
    const DingRTC = DingRTCRef.current
    if (!DingRTC) throw new Error('DingRTC not loaded')

    // Reset MCU audio subscription state before joining
    mcuAudioSubscribed.current = false

    const client = DingRTC.createClient()
    clientRef.current = client

    client.on('user-published', async (user: any, mediaType: 'audio' | 'video', auxiliary?: boolean) => {
      try {
        if (mediaType === 'video') {
          console.log('[RTC] Subscribing to video for user:', user.userId, 'auxiliary:', auxiliary)
          const track = await client.subscribe(user.userId, mediaType, auxiliary)
          console.log('[RTC] Subscribe result:', track, 'type:', typeof track, 'has play:', typeof track?.play)
          
          const videoTrack = track || (auxiliary ? user.auxiliaryTrack : user.videoTrack)
          console.log('[RTC] Final videoTrack:', videoTrack, 'type:', typeof videoTrack)
          
          setState((prev) => {
            const next = new Map(prev.remoteUsers)
            const existing = next.get(user.userId) || { audioTrack: null, videoTrack: null, audioMuted: false, videoOff: false }
            existing.videoTrack = videoTrack
            existing.videoOff = false
            next.set(user.userId, existing)
            console.log('[RTC] Updated remoteUsers for user:', user.userId, 'videoTrack:', videoTrack)
            return { ...prev, remoteUsers: next }
          })
        } else if (mediaType === 'audio') {
          setState((prev) => {
            const next = new Map(prev.remoteUsers)
            const existing = next.get(user.userId) || { audioTrack: null, videoTrack: null, audioMuted: false, videoOff: false }
            existing.audioMuted = false
            next.set(user.userId, existing)
            return { ...prev, remoteUsers: next }
          })
          if (!mcuAudioSubscribed.current) {
            mcuAudioSubscribed.current = true
            try {
              const audioTrack = await client.subscribe('mcu', 'audio')
              audioTrack.play()
            } catch (audioErr) {
              console.error('Failed to subscribe MCU audio:', audioErr)
              mcuAudioSubscribed.current = false
            }
          }
        }
        options.onUserPublished?.(user.userId, mediaType)
      } catch (err) {
        console.error('Failed to subscribe:', err)
      }
    })

    client.on('user-unpublished', (user: any, mediaType: 'audio' | 'video') => {
      setState((prev) => {
        const next = new Map(prev.remoteUsers)
        const existing = next.get(user.userId)
        if (!existing) return prev
        if (mediaType === 'video') {
          existing.videoTrack = null
          existing.videoOff = true
        } else if (mediaType === 'audio') {
          existing.audioMuted = true
        }
        next.set(user.userId, { ...existing })
        return { ...prev, remoteUsers: next }
      })
    })

    client.on('user-joined', (user: any) => {
      setState((prev) => {
        const next = new Map(prev.remoteUsers)
        if (!next.has(user.userId)) {
          next.set(user.userId, { audioTrack: null, videoTrack: null, audioMuted: false, videoOff: false })
        }
        return { ...prev, remoteUsers: next }
      })
      options.onUserJoined?.(user.userId)
    })

    client.on('user-left', (user: any) => {
      setState((prev) => {
        const next = new Map(prev.remoteUsers)
        next.delete(user.userId)
        return { ...prev, remoteUsers: next }
      })
      options.onUserLeft?.(user.userId)
    })

    const response = await client.join({
      uid,
      channel,
      appId: options.appId,
      token,
      userName: uid,
    })

    console.log('[RTC] Join response:', response)
    
    // Process existing remote users who are already in the channel
    if (response?.remoteUsers && Array.isArray(response.remoteUsers)) {
      console.log('[RTC] Found existing remote users:', response.remoteUsers.length)
      
      for (const remoteUser of response.remoteUsers) {
        console.log('[RTC] Processing existing user:', remoteUser.userId, 'has video:', !!remoteUser.videoTrack, 'has audio:', !!remoteUser.audioTrack)
        
        // Add user to state
        setState((prev) => {
          const next = new Map(prev.remoteUsers)
          if (!next.has(remoteUser.userId)) {
            next.set(remoteUser.userId, { 
              audioTrack: remoteUser.audioTrack || null, 
              videoTrack: remoteUser.videoTrack || null, 
              audioMuted: !remoteUser.audioTrack, 
              videoOff: !remoteUser.videoTrack 
            })
          }
          return { ...prev, remoteUsers: next }
        })
        
        // Trigger onUserJoined callback for existing users
        options.onUserJoined?.(remoteUser.userId)
        
        // If user has video, try to subscribe
        if (remoteUser.videoTrack) {
          try {
            console.log('[RTC] Subscribing to existing user video:', remoteUser.userId)
            const track = await client.subscribe(remoteUser.userId, 'video')
            console.log('[RTC] Subscribe result for existing user:', track)
            
            setState((prev) => {
              const next = new Map(prev.remoteUsers)
              const existing = next.get(remoteUser.userId)
              if (existing) {
                existing.videoTrack = track || remoteUser.videoTrack
                existing.videoOff = false
                next.set(remoteUser.userId, existing)
              }
              return { ...prev, remoteUsers: next }
            })
          } catch (err) {
            console.error('[RTC] Failed to subscribe to existing user video:', err)
          }
        }
        
        // If user has audio, try to subscribe MCU
        if (remoteUser.audioTrack && !mcuAudioSubscribed.current) {
          mcuAudioSubscribed.current = true
          try {
            const audioTrack = await client.subscribe('mcu', 'audio')
            audioTrack.play()
          } catch (audioErr) {
            console.error('Failed to subscribe MCU audio:', audioErr)
            mcuAudioSubscribed.current = false
          }
        }
      }
    }

    setState((prev) => ({ ...prev, joined: true }))
    return response
  }, [options])

  const publish = useCallback(async (enableVideo: boolean = true) => {
    const DingRTC = DingRTCRef.current
    const client = clientRef.current
    if (!DingRTC || !client) throw new Error('Not joined')

    const tracks: any[] = []
    let micError = false
    let cameraError = false

    try {
      const micTrack = await DingRTC.createMicrophoneAudioTrack({
        ANS: true,   // 自动降噪
        AEC: true,   // 回声消除
        AGC: true,   // 自动增益控制（防止说话声忽大忽小）
      })
      tracks.push(micTrack)
      localAudioTrackRef.current = micTrack
      setState((prev) => ({ ...prev, localAudioTrack: micTrack }))
      console.log('[RTC] Mic track created successfully')
    } catch (e: any) {
      console.error('Failed to create mic track:', e)
      micError = true
    }

    if (enableVideo) {
      try {
        const cameraTrack = await DingRTC.createCameraVideoTrack({
          frameRate: 15,
          dimension: 'VD_640x360',
        })
        tracks.push(cameraTrack)
        localVideoTrackRef.current = cameraTrack
        setState((prev) => ({ ...prev, localVideoTrack: cameraTrack }))
        console.log('[RTC] Camera track created successfully')
      } catch (e: any) {
        console.error('Failed to create camera track:', e)
        cameraError = true
      }
    }

    // Only publish if we have tracks (SDK doesn't allow publishing empty streams)
    if (tracks.length > 0) {
      try {
        await client.publish(tracks)
        setState((prev) => ({ ...prev, publishing: true }))
        startAudioLevelMonitor()
        console.log('[RTC] Published successfully, tracks:', tracks.length)
      } catch (publishErr) {
        console.error('[RTC] Failed to publish:', publishErr)
        setState((prev) => ({ ...prev, publishing: false }))
      }
    } else {
      console.log('[RTC] No tracks to publish (mic and camera both failed)')
      setState((prev) => ({ ...prev, publishing: false }))
    }

    return { micError, cameraError, published: tracks.length > 0 }
  }, [options, startAudioLevelMonitor])

  const leave = useCallback(async () => {
    stopAudioLevelMonitor()

    const client = clientRef.current
    clientRef.current = null // 先置空防止重复调用

    if (localAudioTrackRef.current) {
      try { localAudioTrackRef.current.close() } catch {}
      localAudioTrackRef.current = null
    }
    if (localVideoTrackRef.current) {
      try { localVideoTrackRef.current.close() } catch {}
      localVideoTrackRef.current = null
    }

    if (client) {
      try {
        await client.leave()
      } catch (err) {
        console.error('RTC leave error:', err)
      }
    }

    mcuAudioSubscribed.current = false

    setState({
      joined: false,
      publishing: false,
      localAudioTrack: null,
      localVideoTrack: null,
      remoteUsers: new Map(),
    })
  }, [stopAudioLevelMonitor])

  const toggleMute = useCallback(async () => {
    const track = localAudioTrackRef.current
    if (!track) return

    try {
      if (muted) {
        if (typeof track.setEnabled === 'function') {
          await track.setEnabled(true)
        } else if (typeof track.unmute === 'function') {
          await track.unmute()
        }
        setMuted(false)
      } else {
        if (typeof track.setEnabled === 'function') {
          await track.setEnabled(false)
        } else if (typeof track.mute === 'function') {
          await track.mute()
        }
        setMuted(true)
        setAudioLevel(0)
      }
    } catch (err) {
      console.error('Toggle mute error:', err)
    }
  }, [muted])

  const toggleVideo = useCallback(async () => {
    const track = localVideoTrackRef.current
    if (!track || videoToggling) return

    setVideoToggling(true)
    
    // 乐观更新 - 先切换 UI
    const newState = !videoEnabled
    setVideoEnabled(newState)

    try {
      if (typeof track.setEnabled === 'function') {
        await track.setEnabled(newState)
      }
    } catch (err) {
      // 失败时回滚
      setVideoEnabled(!newState)
      console.error('Toggle video error:', err)
    } finally {
      setVideoToggling(false)
    }
  }, [videoEnabled, videoToggling])

  const playRemoteVideo = useCallback((userId: string, elementOrId: string | HTMLElement) => {
    const user = state.remoteUsers.get(userId)
    if (user?.videoTrack) {
      console.log('[RTC] Playing remote video for userId:', userId, 'element type:', typeof elementOrId, 'is HTMLElement:', elementOrId instanceof HTMLElement)
      user.videoTrack.play(elementOrId)
      console.log('[RTC] Remote video play called successfully for userId:', userId)
    } else {
      console.log('[RTC] No video track found for userId:', userId, 'user:', user)
      throw new Error('No video track found')
    }
  }, [state])

  const getLocalStats = useCallback(async () => {
    const client = clientRef.current
    if (!client) return null
    
    try {
      const videoStats = await client.getLocalVideoStats()
      const audioStats = await client.getLocalAudioStats()
      return { video: videoStats, audio: audioStats }
    } catch (err) {
      console.error('[RTC] Failed to get local stats:', err)
      return null
    }
  }, [])

  return {
    ...state,
    muted,
    videoEnabled,
    videoToggling,
    audioLevel,
    hasCamera,
    hasMic,
    join,
    publish,
    leave,
    toggleMute,
    toggleVideo,
    playRemoteVideo,
    checkDevices,
    getLocalStats,
  }
}
