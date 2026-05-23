'use client'
import { useRef, useState, useCallback, useEffect } from 'react'

interface RTCState {
  joined: boolean
  publishing: boolean
  localAudioTrack: any | null
  localVideoTrack: any | null
  remoteUsers: Map<string, { audioTrack: any; videoTrack: any; audioMuted: boolean; videoOff: boolean }>
  mcuAudioTrack: any | null
}

interface UseRTCOptions {
  appId: string
  localUserId?: number
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
    mcuAudioTrack: null,
  })
  const [muted, setMuted] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [videoToggling, setVideoToggling] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [hasCamera, setHasCamera] = useState<boolean | null>(null)
  const [hasMic, setHasMic] = useState<boolean | null>(null)
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set())
  const DingRTCRef = useRef<any>(null)
  const mcuAudioSubscribed = useRef(false)
  const audioLevelInterval = useRef<NodeJS.Timeout | null>(null)
  const speakingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

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
      // Monitor local audio level
      if (localAudioTrackRef.current) {
        try {
          const level = localAudioTrackRef.current.getVolumeLevel()
          setAudioLevel(level)
          
          // Update speaking users for local user
          if (level > 0.3) {
            setSpeakingUsers(prev => {
              const next = new Set(prev)
              next.add(`user_${options.localUserId}`)
              return next
            })
          }
        } catch {
          setAudioLevel(0)
        }
      } else {
        setAudioLevel(0)
      }
      
      // Monitor remote users audio levels
      setState(prev => {
        const newSpeakingUsers = new Set<string>()
        prev.remoteUsers.forEach((user, userId) => {
          if (user.audioTrack && !user.audioMuted) {
            try {
              const level = user.audioTrack.getVolumeLevel()
              if (level > 0.3) {
                newSpeakingUsers.add(userId)
              }
            } catch {}
          }
        })
        
        // Update speaking users
        setSpeakingUsers(prevSpeaking => {
          const next = new Set(prevSpeaking)
          // Keep local user if speaking
          if (prev.localAudioTrack) {
            try {
              const localLevel = prev.localAudioTrack.getVolumeLevel()
              if (localLevel > 0.3) {
                next.add(`user_${options.localUserId}`)
              }
            } catch {}
          }
          // Add remote speaking users
          newSpeakingUsers.forEach(uid => next.add(uid))
          return next
        })
        
        return prev
      })
    }, 200)
  }, [options.localUserId])

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
          // Subscribe to individual user audio for live translation
          let userAudioTrack = null
          try {
            userAudioTrack = await client.subscribe(user.userId, mediaType)
            console.log('[RTC] Subscribed to user audio:', user.userId)
          } catch (audioErr) {
            console.log('[RTC] Failed to subscribe to user audio:', user.userId, audioErr)
          }
          
          setState((prev) => {
            const next = new Map(prev.remoteUsers)
            const existing = next.get(user.userId) || { audioTrack: null, videoTrack: null, audioMuted: false, videoOff: false }
            existing.audioTrack = userAudioTrack || existing.audioTrack
            existing.audioMuted = false
            next.set(user.userId, existing)
            return { ...prev, remoteUsers: next }
          })
          
          if (!mcuAudioSubscribed.current) {
            mcuAudioSubscribed.current = true
            try {
              const audioTrack = await client.subscribe('mcu', 'audio')
              audioTrack.play()
              console.log('[RTC] MCU audio subscribed and playing')
              // Store MCU audio track for live translation
              setState(prev => ({ ...prev, mcuAudioTrack: audioTrack }))
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

    // Listen for user-info-updated events (mute/unmute state changes)
    client.on('user-info-updated', (uid: string, msg: string) => {
      console.log('[RTC] User info updated:', uid, msg)
      setState((prev) => {
        const next = new Map(prev.remoteUsers)
        const existing = next.get(uid)
        if (existing) {
          if (msg === 'mute-audio') {
            existing.audioMuted = true
          } else if (msg === 'unmute-audio') {
            existing.audioMuted = false
          } else if (msg === 'mute-video') {
            existing.videoOff = true
          } else if (msg === 'unmute-video') {
            existing.videoOff = false
          }
          next.set(uid, { ...existing })
        }
        return { ...prev, remoteUsers: next }
      })
    })

    // Listen for user-mic-audio-muted events
    client.on('user-mic-audio-muted', (uid: string, muted: boolean) => {
      console.log('[RTC] User mic audio muted:', uid, muted)
      setState((prev) => {
        const next = new Map(prev.remoteUsers)
        const existing = next.get(uid)
        if (existing) {
          existing.audioMuted = muted
          next.set(uid, { ...existing })
        }
        return { ...prev, remoteUsers: next }
      })
    })

    // Listen for volume-indicator events to detect who is speaking
    client.on('volume-indicator', (uids: string[]) => {
      console.log('[RTC] Volume indicator - speaking users:', uids)
      
      // Update speaking users
      setSpeakingUsers(new Set(uids))
      
      // Clear previous timeouts
      speakingTimeoutRef.current.forEach((timeout) => {
        clearTimeout(timeout)
      })
      speakingTimeoutRef.current.clear()
      
      // Set timeout to clear speaking status after 1 second of silence
      uids.forEach(uid => {
        const timeout = setTimeout(() => {
          setSpeakingUsers(prev => {
            const next = new Set(prev)
            next.delete(uid)
            return next
          })
          speakingTimeoutRef.current.delete(uid)
        }, 1000)
        speakingTimeoutRef.current.set(uid, timeout)
      })
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
        
        // Try to subscribe to video for all existing users (SDK may not return videoTrack directly)
        try {
          console.log('[RTC] Subscribing to existing user video:', remoteUser.userId)
          const track = await client.subscribe(remoteUser.userId, 'video')
          console.log('[RTC] Subscribe result for existing user:', track)
          
          if (track) {
            setState((prev) => {
              const next = new Map(prev.remoteUsers)
              const existing = next.get(remoteUser.userId)
              if (existing) {
                existing.videoTrack = track
                existing.videoOff = false
                next.set(remoteUser.userId, existing)
              }
              return { ...prev, remoteUsers: next }
            })
          }
        } catch (err) {
          console.log('[RTC] No video available for existing user:', remoteUser.userId, err)
        }
        
        // Try to subscribe to audio for all existing users
        try {
          console.log('[RTC] Subscribing to existing user audio:', remoteUser.userId)
          const audioTrack = await client.subscribe(remoteUser.userId, 'audio')
          console.log('[RTC] Audio subscribe result for existing user:', audioTrack)
          
          if (audioTrack) {
            setState((prev) => {
              const next = new Map(prev.remoteUsers)
              const existing = next.get(remoteUser.userId)
              if (existing) {
                existing.audioTrack = audioTrack
                existing.audioMuted = false
                next.set(remoteUser.userId, existing)
              }
              return { ...prev, remoteUsers: next }
            })
          }
        } catch (err) {
          console.log('[RTC] No audio available for existing user:', remoteUser.userId, err)
        }
      }
    }

    // Subscribe to MCU audio for live translation (even if no users have published audio yet)
    if (!mcuAudioSubscribed.current) {
      try {
        const audioTrack = await client.subscribe('mcu', 'audio')
        audioTrack.play()
        console.log('[RTC] MCU audio subscribed during join')
        setState(prev => ({ ...prev, mcuAudioTrack: audioTrack }))
        mcuAudioSubscribed.current = true
      } catch (audioErr) {
        console.log('[RTC] MCU audio not available during join:', audioErr)
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

    // Clear speaking timeouts
    speakingTimeoutRef.current.forEach((timeout) => {
      clearTimeout(timeout)
    })
    speakingTimeoutRef.current.clear()
    setSpeakingUsers(new Set())

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
      mcuAudioTrack: null,
    })
  }, [stopAudioLevelMonitor])

  const toggleMute = useCallback(async () => {
    const track = localAudioTrackRef.current
    if (!track) return

    try {
      if (muted) {
        // Unmute
        if (typeof track.unmute === 'function') {
          await track.unmute()
        } else if (typeof track.setEnabled === 'function') {
          await track.setEnabled(true)
        }
        setMuted(false)
        console.log('[RTC] Unmuted audio')
      } else {
        // Mute
        if (typeof track.mute === 'function') {
          await track.mute()
        } else if (typeof track.setEnabled === 'function') {
          await track.setEnabled(false)
        }
        setMuted(true)
        setAudioLevel(0)
        console.log('[RTC] Muted audio')
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
      // Use mute/unmute methods if available (these notify other users)
      if (newState) {
        // Enable video
        if (typeof track.unmute === 'function') {
          await track.unmute()
        } else if (typeof track.setEnabled === 'function') {
          await track.setEnabled(true)
        }
        console.log('[RTC] Unmuted video')
      } else {
        // Disable video
        if (typeof track.mute === 'function') {
          await track.mute()
        } else if (typeof track.setEnabled === 'function') {
          await track.setEnabled(false)
        }
        console.log('[RTC] Muted video')
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
    speakingUsers,
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
