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

    const client = DingRTC.createClient()
    clientRef.current = client

    client.on('user-published', async (user: any, mediaType: 'audio' | 'video', auxiliary?: boolean) => {
      try {
        if (mediaType === 'video') {
          await client.subscribe(user.userId, mediaType, auxiliary)
          setState((prev) => {
            const next = new Map(prev.remoteUsers)
            const existing = next.get(user.userId) || { audioTrack: null, videoTrack: null, audioMuted: false, videoOff: false }
            existing.videoTrack = auxiliary ? user.auxiliaryTrack : user.videoTrack
            existing.videoOff = false
            next.set(user.userId, existing)
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
            const audioTrack = await client.subscribe('mcu', 'audio')
            audioTrack.play()
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

    setState((prev) => ({ ...prev, joined: true }))
    mcuAudioSubscribed.current = false
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
    } catch (e: any) {
      console.error('Failed to create mic track:', e)
      micError = true
      options.onError?.('麦克风未授权或不可用')
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
      } catch (e: any) {
        console.error('Failed to create camera track:', e)
        cameraError = true
      }
    }

    if (tracks.length > 0) {
      await client.publish(tracks)
      setState((prev) => ({ ...prev, publishing: true }))
      startAudioLevelMonitor()
    }

    return { micError, cameraError }
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

  const playRemoteVideo = useCallback((userId: string, elementId: string) => {
    const user = state.remoteUsers.get(userId)
    if (user?.videoTrack) {
      user.videoTrack.play(elementId)
    }
  }, [state])

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
  }
}
