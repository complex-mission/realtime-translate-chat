'use client'
import { useEffect, useRef, useCallback } from 'react'
import { IconMic, IconMicOff, IconVideo, IconVideoOff, IconTranslate, IconSpinner } from '@/components/ui/icon'
import SignedImage from '@/components/ui/signed-image'

// Add styles for responsive call cards
const callCardStyles = `
  @media (max-width: 450px) {
    .call-card {
      flex: 1 1 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
    }
  }
`

interface CallParticipant {
  user_id: number
  nickname: string
  avatar_url?: string | null
}

interface RemoteUser {
  audioTrack: any
  videoTrack: any
  audioMuted: boolean
  videoOff: boolean
}

interface CallAreaProps {
  participants: CallParticipant[]
  remoteUsers: Map<string, RemoteUser>
  localVideoTrack: any
  muted: boolean
  videoEnabled: boolean
  videoToggling: boolean
  audioLevel: number
  hasCamera: boolean | null
  hasMic: boolean | null
  subtitleFontSize: 'sm' | 'base' | 'lg'
  collapsed: boolean
  onToggleCollapse: () => void
  onToggleMute: () => void
  onToggleVideo: () => void
  onLeave: () => void
  leavingCall: boolean
  localUserId?: number
  playRemoteVideo: (userId: string, elementOrId: string | HTMLElement) => void
  publishStats?: any
  speakingUsers?: Set<string>
}

export default function CallArea({
  participants,
  remoteUsers,
  localVideoTrack,
  muted,
  videoEnabled,
  videoToggling,
  audioLevel,
  hasCamera,
  hasMic,
  subtitleFontSize,
  collapsed,
  onToggleCollapse,
  onToggleMute,
  onToggleVideo,
  onLeave,
  leavingCall,
  localUserId,
  playRemoteVideo,
  publishStats,
  speakingUsers,
}: CallAreaProps) {
  const localVideoRef = useRef<HTMLDivElement>(null)
  const videoPlayTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const playedTracksRef = useRef<Set<string>>(new Set())

  // Function to safely play remote video with retry
  const safePlayRemoteVideo = useCallback((userId: string, elementId: string, retryCount: number = 0) => {
    const MAX_RETRIES = 15
    
    // Skip if already played successfully
    const trackKey = `${userId}-played`
    if (playedTracksRef.current.has(trackKey) && retryCount === 0) return
    
    const el = document.getElementById(elementId)
    if (!el) {
      // DOM not ready, retry with increasing delay
      if (retryCount < MAX_RETRIES) {
        const delay = Math.min(500 * Math.pow(1.5, retryCount), 3000)
        console.log(`[CallArea] DOM not ready for ${elementId}, retry ${retryCount + 1}/${MAX_RETRIES} in ${delay}ms`)
        const timer = setTimeout(() => {
          safePlayRemoteVideo(userId, elementId, retryCount + 1)
        }, delay)
        videoPlayTimersRef.current.set(`${userId}-retry`, timer)
      } else {
        console.warn(`[CallArea] Max retries reached for ${elementId}`)
      }
      return
    }
    
    // Check if element is actually in the document body
    if (!document.body.contains(el)) {
      console.log(`[CallArea] Element ${elementId} exists but not in DOM body, retrying...`)
      if (retryCount < MAX_RETRIES) {
        const timer = setTimeout(() => {
          safePlayRemoteVideo(userId, elementId, retryCount + 1)
        }, 500)
        videoPlayTimersRef.current.set(`${userId}-retry`, timer)
      }
      return
    }
    
    try {
      // Pass the element directly instead of the ID string
      console.log(`[CallArea] Playing video for ${userId} into element:`, el)
      playRemoteVideo(userId, el)
      playedTracksRef.current.add(trackKey)
      console.log(`[CallArea] Successfully started playing video for ${userId}`)
    } catch (err) {
      console.error('[CallArea] Failed to play remote video:', err)
      // Retry on error
      if (retryCount < MAX_RETRIES) {
        const delay = Math.min(500 * Math.pow(1.5, retryCount), 3000)
        const timer = setTimeout(() => {
          safePlayRemoteVideo(userId, elementId, retryCount + 1)
        }, delay)
        videoPlayTimersRef.current.set(`${userId}-retry`, timer)
      }
    }
  }, [playRemoteVideo])

  // Play local video when track is ready
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      // Delay to ensure DOM is ready
      const timer = setTimeout(() => {
        try {
          if (localVideoRef.current) {
            localVideoTrack.play(localVideoRef.current)
          }
        } catch (err) {
          console.error('Failed to play local video:', err)
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [localVideoTrack])

  // Clear played tracks when participants or remoteUsers change
  useEffect(() => {
    const currentIds = new Set(participants.map(p => p.user_id))
    const keysToDelete: string[] = []
    
    playedTracksRef.current.forEach(key => {
      const userIdPart = key.split('-')[0] // e.g., "user_1"
      const numericId = parseInt(userIdPart.replace('user_', ''))
      
      // Remove if user no longer in participants
      if (!currentIds.has(numericId)) {
        keysToDelete.push(key)
        return
      }
      
      // Remove if user's videoTrack changed (re-join scenario)
      const remoteUser = remoteUsers.get(userIdPart)
      if (remoteUser && !remoteUser.videoTrack) {
        keysToDelete.push(key)
      }
    })
    
    keysToDelete.forEach(key => {
      console.log('[CallArea] Clearing played track cache:', key)
      playedTracksRef.current.delete(key)
    })
  }, [participants, remoteUsers])

  // Play remote videos when participants or remoteUsers change
  useEffect(() => {
    // Clear existing timers
    videoPlayTimersRef.current.forEach(timer => clearTimeout(timer))
    videoPlayTimersRef.current.clear()

    console.log('[CallArea] useEffect triggered - participants:', participants.length, 'remoteUsers:', remoteUsers.size)
    
    // Schedule video playback with delays to ensure DOM is ready
    participants.forEach((p, index) => {
      if (p.user_id === localUserId) {
        console.log('[CallArea] Skipping local user:', p.user_id)
        return
      }
      
      const remoteUserId = `user_${p.user_id}`
      const remoteUser = remoteUsers.get(remoteUserId)
      
      console.log(`[CallArea] Checking user ${remoteUserId}:`, {
        hasVideoTrack: !!remoteUser?.videoTrack,
        videoTrackType: typeof remoteUser?.videoTrack,
        videoOff: remoteUser?.videoOff
      })
      
      if (remoteUser?.videoTrack) {
        // Use longer initial delay to ensure DOM is rendered
        const initialDelay = 800 + (300 * index) // 800ms, 1100ms, 1400ms...
        console.log(`[CallArea] Scheduling video play for ${remoteUserId} in ${initialDelay}ms`)
        
        const timer = setTimeout(() => {
          console.log(`[CallArea] Timer fired, attempting to play video for ${remoteUserId}`)
          safePlayRemoteVideo(remoteUserId, `remote-video-${remoteUserId}`)
        }, initialDelay)
        
        videoPlayTimersRef.current.set(`${remoteUserId}-init`, timer)
      } else {
        console.log(`[CallArea] No video track for ${remoteUserId}, skipping`)
      }
    })

    return () => {
      console.log('[CallArea] Cleanup: clearing timers')
      videoPlayTimersRef.current.forEach(timer => clearTimeout(timer))
      videoPlayTimersRef.current.clear()
    }
  }, [participants, remoteUsers, localUserId, safePlayRemoteVideo])

  // Expand/collapse handler - replay videos when expanding
  useEffect(() => {
    if (!collapsed) {
      // Clear played tracks cache when expanding
      playedTracksRef.current.clear()
      
      // Wait for DOM to render
      setTimeout(() => {
        try {
          if (localVideoTrack && localVideoRef.current) {
            localVideoTrack.play(localVideoRef.current)
          }
          
          participants.forEach((p, index) => {
            if (p.user_id === localUserId) return
            
            const remoteUserId = `user_${p.user_id}`
            const remoteUser = remoteUsers.get(remoteUserId)
            
            if (remoteUser?.videoTrack) {
              // Stagger playback
              setTimeout(() => {
                safePlayRemoteVideo(remoteUserId, `remote-video-${remoteUserId}`)
              }, 200 * index)
            }
          })
        } catch (err) {
          console.error('Failed to play videos on expand:', err)
        }
      }, 500)
    }
  }, [collapsed])

  return (
    <>
      <style>{callCardStyles}</style>
      <div style={{ background: '#eff6ff', borderBottom: '1px solid #bfdbfe' }}>
      <div className="flex items-center justify-between px-4 py-2.5">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-sm font-medium text-blue-800 transition hover:text-blue-900"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          通话中 ({participants.length}人)
          <svg
            className={`h-4 w-4 text-blue-600 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleMute}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
              muted
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
            style={{ border: muted ? 'none' : '1px solid var(--border-color)' }}
            title={muted ? '取消静音' : '静音'}
          >
            {muted ? <IconMicOff size={15} /> : <IconMic size={15} />}
          </button>
          <button
            onClick={onToggleVideo}
            disabled={videoToggling}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
              !videoEnabled
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            } ${videoToggling ? 'opacity-70 cursor-wait' : ''}`}
            style={{ border: videoEnabled ? '1px solid var(--border-color)' : 'none' }}
            title={videoEnabled ? '关闭视频' : '开启视频'}
          >
            {videoToggling ? (
              <IconSpinner size={15} />
            ) : videoEnabled ? (
              <IconVideo size={15} />
            ) : (
              <IconVideoOff size={15} />
            )}
          </button>
          <button
            onClick={onLeave}
            disabled={leavingCall}
            className="flex h-8 items-center gap-1.5 rounded-full bg-red-500 px-3 text-xs text-white font-medium transition hover:bg-red-600 disabled:opacity-70"
          >
            {leavingCall ? '退出中...' : '退出'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4">
          <div style={{ 
            display: 'flex',
            gap: '12px',
            maxHeight: '60vh'
          }}>
            {/* Video cards area */}
            <div className="flex-1 overflow-y-auto" style={{ 
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              minWidth: 0
            }}>
              {/* Local user card */}
              {(() => {
                const localSpeaking = speakingUsers?.has(`user_${localUserId}`) || false
                return (
                  <div className={`relative aspect-video rounded-xl overflow-hidden bg-slate-900 call-card ${localSpeaking ? 'ring-4 ring-green-500' : ''}`} style={{ 
                    flex: '1 1 200px',
                    maxWidth: '600px',
                    minWidth: '200px',
                    transition: 'box-shadow 0.2s ease'
                  }}>
                {localVideoTrack ? (
                  <div ref={localVideoRef} className="h-full w-full" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="h-16 w-16 rounded-full overflow-hidden bg-blue-100">
                      {(() => {
                        const localParticipant = participants.find((p) => p.user_id === localUserId)
                        if (localParticipant?.avatar_url) {
                          return <SignedImage src={localParticipant.avatar_url} alt="" className="h-full w-full object-cover" />
                        }
                        return (
                          <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-blue-700">
                            {localParticipant?.nickname?.[0] || '我'}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  {hasCamera === false && (
                    <span className="rounded-md bg-red-500/80 px-1.5 py-0.5 text-[10px] text-white">无摄像头</span>
                  )}
                  {hasMic === false && (
                    <span className="rounded-md bg-red-500/80 px-1.5 py-0.5 text-[10px] text-white">无麦克风</span>
                  )}
                  {muted && (
                    <span className="rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] text-white flex items-center gap-0.5">
                      <IconMicOff size={10} /> 已静音
                    </span>
                )}
              </div>
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                <span className="rounded-md bg-black/50 px-2 py-0.5 text-xs text-white">我</span>
                <div className="flex items-center gap-1">
                  {/* Publish status indicator */}
                  {publishStats ? (
                    <span className="rounded-md bg-green-500/80 px-1.5 py-0.5 text-[10px] text-white flex items-center gap-0.5">
                      ● 推流中
                    </span>
                  ) : localVideoTrack ? (
                    <span className="rounded-md bg-yellow-500/80 px-1.5 py-0.5 text-[10px] text-white flex items-center gap-0.5">
                      ◐ 连接中
                    </span>
                  ) : (
                    <span className="rounded-md bg-gray-500/80 px-1.5 py-0.5 text-[10px] text-white flex items-center gap-0.5">
                      ○ 仅观看
                    </span>
                  )}
                  {hasMic !== false && (
                    <div className="flex items-center gap-1">
                      {muted ? (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/80">
                          <IconMicOff size={12} className="text-white" />
                          <span className="text-[10px] text-white">静音中</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <IconMic size={12} className={audioLevel > 0.2 ? 'text-blue-400' : 'text-white/50'} />
                          <div className="h-1 w-20 rounded-full bg-white/20 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-200"
                              style={{
                                width: `${audioLevel < 0.1 ? 0 : Math.min(Math.pow((audioLevel - 0.1) / 0.4, 1.5) * 100, 100)}%`,
                                background: audioLevel > 0.35 ? '#3b82f6' : audioLevel > 0.2 ? '#93c5fd' : '#94a3b8',
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            )
            })()}

            {participants
              .filter((p) => p.user_id !== localUserId)
              .map((p) => {
                const remoteUserId = `user_${p.user_id}`
                const remoteUser = remoteUsers.get(remoteUserId)
                // Use explicit check for videoTrack existence
                const hasVideo = remoteUser && remoteUser.videoTrack != null && typeof remoteUser.videoTrack === 'object'

                console.log(`[CallArea] Rendering user ${remoteUserId}:`, {
                  hasRemoteUser: !!remoteUser,
                  videoTrack: remoteUser?.videoTrack,
                  videoTrackType: typeof remoteUser?.videoTrack,
                  hasVideo,
                  videoOff: remoteUser?.videoOff
                })

                return (
                  <div key={p.user_id} className={`relative aspect-video rounded-xl overflow-hidden bg-slate-900 call-card ${speakingUsers?.has(remoteUserId) ? 'ring-4 ring-green-500' : ''}`} style={{ 
                    flex: '1 1 200px',
                    maxWidth: '600px',
                    minWidth: '200px',
                    transition: 'box-shadow 0.2s ease'
                  }}>
                    {hasVideo ? (
                      <div id={`remote-video-${remoteUserId}`} className="h-full w-full" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="h-16 w-16 rounded-full overflow-hidden bg-blue-100">
                          {p.avatar_url ? (
                            <SignedImage src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-blue-700">
                              {p.nickname?.[0] || '?'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      {remoteUser?.videoOff && (
                        <span className="rounded-md bg-red-500/80 px-1.5 py-0.5 text-[10px] text-white flex items-center gap-0.5">
                          <IconVideoOff size={10} /> 已关闭视频
                        </span>
                      )}
                      {remoteUser?.audioMuted && (
                        <span className="rounded-md bg-red-500/80 px-1.5 py-0.5 text-[10px] text-white flex items-center gap-0.5">
                          <IconMicOff size={10} /> 已静音
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                      <span className="rounded-md bg-black/50 px-2 py-0.5 text-xs text-white">{p.nickname}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
