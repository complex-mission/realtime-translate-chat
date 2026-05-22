'use client'
import { useEffect, useState, useRef, useContext, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Script from 'next/script'
import { UserContext } from '../../layout'
import { useSocket } from '@/hooks/useSocket'
import { useRTC } from '@/hooks/useRTC'
import { useLiveTranslate } from '@/hooks/useLiveTranslate'
import { useToast } from '@/components/ui/toast'
import SignedImage from '@/components/ui/signed-image'
import { IconPhone, IconPhoneOff, IconMic, IconMicOff, IconVideo, IconVideoOff, IconFileText, IconSettings, IconXCircle, IconX, IconSpinner, IconTranslate, IconCheckCircle, IconAlertTriangle, IconClock, IconRefresh } from '@/components/ui/icon'
import RoomSettingsModal from './room-settings-modal'
import CallArea from '@/components/call-area'
import RichInput from '@/components/rich-input'
import EmojiText from '@/components/ui/emoji-text'

declare global {
  interface Window {
    PhotoSwipe: any
    PhotoSwipeLightbox: any
  }
}

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const rid = parseInt(roomId)
  const { user } = useContext(UserContext)
  const router = useRouter()
  const [messages, setMessages] = useState<any[]>([])
  const [room, setRoom] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [inCall, setInCall] = useState(false)
  const [callSid, setCallSid] = useState<number | null>(null)
  const [subtitles, setSubtitles] = useState<Map<number, { text: string; translated: string; targetLang?: string }>>(new Map())
  const [showSummary, setShowSummary] = useState(false)
  const [summaryContent, setSummaryContent] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryTimeStart, setSummaryTimeStart] = useState('')
  const [summaryTimeEnd, setSummaryTimeEnd] = useState('')
  const [translating, setTranslating] = useState<Set<number>>(new Set())
  const [translations, setTranslations] = useState<Map<number, string>>(new Map())
  const [callCollapsed, setCallCollapsed] = useState(false)
  const [subtitleFontSize, setSubtitleFontSize] = useState<'sm'|'base'|'lg'>('base')
  const [subtitleEnabled, setSubtitleEnabled] = useState(true)
  const [rtcReconnecting, setRtcReconnecting] = useState(false)
  const [rtcRetryCount, setRtcRetryCount] = useState(0)
  const [sendFailed, setSendFailed] = useState<Map<number, string>>(new Map())
  const [callError, setCallError] = useState('')
  const [joiningCall, setJoiningCall] = useState(false)
  const [leavingCall, setLeavingCall] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [pendingImages, setPendingImages] = useState<File[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true)
  const shouldScrollRef = useRef(true)
  const loadingMoreRef = useRef(false)
  const hasMoreRef = useRef(true)
  const endRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null
  const { toast } = useToast()
  const { socket, connected, joinRoom, leaveRoom, on } = useSocket(token)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = date.toDateString() === yesterday.toDateString()

    if (isToday) return '今天'
    if (isYesterday) return '昨天'
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  const rtc = useRTC({
    appId: process.env.NEXT_PUBLIC_RTC_APP_ID || '',
    onUserPublished: (userId, mediaType) => {},
    onUserLeft: (userId) => {},
    onError: (error) => {
      console.error('RTC error:', error)
      toast('error', error)
    },
  })

  const liveTranslate = useLiveTranslate({
    roomId: rid,
    token,
    socket,
    userLangPref: user?.lang_pref || 'zh', // 用户的语言偏好
    onSubtitle: (data) => {
      setSubtitles(prev => {
        const next = new Map(prev)
        next.set(data.userId, { text: data.text, translated: data.translated, targetLang: data.targetLang })
        return next
      })
    },
  })

  const fetchRoom = useCallback(async () => {
    if (!token) return
    try {
      const r = await fetch('/api/v1/rooms/' + rid, { headers: { Authorization: 'Bearer ' + token } })
      const d = await r.json()
      if (d.success) setRoom(d.data)
      else router.push('/chat')
    } catch { router.push('/chat') }
  }, [rid, token, router])

  const fetchMembers = useCallback(async () => {
    if (!token) return
    try {
      const r = await fetch('/api/v1/rooms/' + rid + '/members', { headers: { Authorization: 'Bearer ' + token } })
      const d = await r.json()
      if (d.success) setMembers(d.data)
    } catch {}
  }, [rid, token])

  const fetchMessages = useCallback(async (beforeId?: number) => {
    if (!token) return
    try {
      const url = beforeId
        ? `/api/v1/rooms/${rid}/messages?limit=20&before_id=${beforeId}`
        : `/api/v1/rooms/${rid}/messages?limit=20`
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      const d = await r.json()
      if (d.success) {
        const newMessages = d.data
        if (beforeId) {
          setMessages(prev => [...newMessages, ...prev])
          setShouldScrollToBottom(false)
        } else {
          setMessages(newMessages)
          setShouldScrollToBottom(true)
        }
        setHasMore(newMessages.length >= 20)
        return newMessages.length
      }
    } finally { setLoading(false) }
    return 0
  }, [rid, token])

  useEffect(() => { fetchRoom(); fetchMessages(); fetchMembers() }, [fetchRoom, fetchMessages, fetchMembers])
  useEffect(() => { if (connected && rid) joinRoom(rid) }, [connected, rid, joinRoom])

  // 同步 ref 和 state
  useEffect(() => { loadingMoreRef.current = loadingMore }, [loadingMore])
  useEffect(() => { hasMoreRef.current = hasMore }, [hasMore])
  useEffect(() => { shouldScrollRef.current = shouldScrollToBottom }, [shouldScrollToBottom])

  const loadMoreMessages = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || !token) return
    loadingMoreRef.current = true  // 立即同步设置，防止并发重复请求
    setLoadingMore(true)
    try {
      const container = containerRef.current
      const scrollHeightBefore = container?.scrollHeight || 0
      
      // 获取当前最早的消息 id
      const oldestMsgId = messages.length > 0 ? messages[0].id : undefined
      const count = await fetchMessages(oldestMsgId)
      
      // 保持滚动位置：双帧确保在 React DOM 更新后执行
      if (container && count && count > 0) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const scrollHeightAfter = container.scrollHeight
            container.scrollTop = scrollHeightAfter - scrollHeightBefore
          })
        })
      }
    } finally { setLoadingMore(false) }
  }, [token, messages, fetchMessages])

  const initialFillDoneRef = useRef(false)

  // 滚动到顶部时加载更多
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    if (container.scrollTop < 50 && hasMoreRef.current && !loadingMoreRef.current) {
      loadMoreMessages()
    }
  }, [loadMoreMessages])

  useEffect(() => {
    if (loading) return
    
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [loading, handleScroll])

  // Cleanup on unmount - 离开页面时清理 RTC 资源
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (inCall) {
        rtc.leave()
        liveTranslate.stopCapture()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (inCall) {
        rtc.leave()
        liveTranslate.stopCapture()
      }
    }
  }, [inCall])

  useEffect(() => {
    if (!socket) return
    const u1 = on('message:new', (m: any) => {
      if (m.room_id === rid) {
        setMessages(p => {
          // Avoid duplicate messages (API response may arrive before socket event)
          if (p.some(existing => existing.id === m.id)) return p
          return [...p, m]
        })
        setShouldScrollToBottom(true)
      }
    })
    const u2 = on('subtitle:stream', (d: any) => {
      // 只处理匹配用户语言偏好的字幕
      const userLang = user?.lang_pref || 'zh'
      if (d.target_lang && d.target_lang !== userLang) {
        return // 忽略不匹配的字幕
      }
      setSubtitles(p => {
        const n = new Map(p)
        if (d.is_final) {
          // 最终结果，显示后 5 秒自动消失
          n.set(d.user_id || 0, { text: d.text_original || '', translated: d.text_translated, targetLang: d.target_lang })
          setTimeout(() => {
            setSubtitles(prev => {
              const next = new Map(prev)
              next.delete(d.user_id || 0)
              return next
            })
          }, 5000)
        } else {
          n.set(d.user_id || 0, { text: d.text_original || '', translated: d.text_translated, targetLang: d.target_lang })
        }
        return n
      })
    })
    const u3 = on('call:started', (d: any) => setCallSid(d.call_session_id))
    const u4 = on('call:ended', () => { setInCall(false); setCallSid(null); setSubtitles(new Map()) })
    const u5 = on('room:closed', () => { toast('warning', '聊天室已被关闭'); setTimeout(() => router.push('/chat'), 2000) })
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [socket, rid, callSid, on, user?.lang_pref])

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [])

  useEffect(() => {
    if (shouldScrollToBottom) {
      scrollToBottom()
      if (!initialFillDoneRef.current) {
        initialFillDoneRef.current = true
        // 跳到底部后 DOM 已就绪，判断内容是否撑满屏幕
        const container = containerRef.current
        if (container && hasMoreRef.current && !loadingMoreRef.current &&
            container.scrollHeight <= container.clientHeight) {
          loadMoreMessages()
        }
      }
    }
  }, [messages, scrollToBottom, shouldScrollToBottom, loadMoreMessages])

  const sendMessage = async (text?: string, retryMsgId?: number) => {
    const content = text || ''
    const currentImages = [...pendingImages]
    const hasImages = currentImages.length > 0
    if ((!content.trim() && !hasImages) || !token || sending) return
    setSending(true)

    // Optimistic: add messages to list immediately
    const tempIds: number[] = []
    const clientKeys: string[] = []
    let tempIdCounter = Date.now()
    if (!retryMsgId) {
      // Add image optimistic messages
      for (const file of currentImages) {
        const imgTempId = -(++tempIdCounter)
        const clientKey = `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        tempIds.push(imgTempId)
        clientKeys.push(clientKey)
        const optimisticImg = {
          id: imgTempId, _clientKey: clientKey, room_id: rid, sender_id: user?.id, msg_type: 'image',
          content: URL.createObjectURL(file), created_at: new Date().toISOString(),
          sender_nickname: user?.nickname, sender_avatar: user?.avatar_url, _sending: true,
        }
        setMessages(p => [...p, optimisticImg])
      }
      // Add text optimistic message
      if (content.trim()) {
        const textTempId = -(++tempIdCounter)
        const clientKey = `txt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        tempIds.push(textTempId)
        clientKeys.push(clientKey)
        const optimisticMsg = {
          id: textTempId, _clientKey: clientKey, room_id: rid, sender_id: user?.id, msg_type: 'text',
          content: content.trim(), created_at: new Date().toISOString(),
          sender_nickname: user?.nickname, sender_avatar: user?.avatar_url, _sending: true,
        }
        setMessages(p => [...p, optimisticMsg])
      }
      setPendingImages([])
      setShouldScrollToBottom(true)
    }

    try {
      // Send images first
      const serverImageMsgs: any[] = []
      if (hasImages) {
        for (const file of currentImages) {
          const fd = new FormData()
          fd.append('image', file)
          const ir = await fetch('/api/v1/rooms/' + rid + '/images', {
            method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd,
          })
          const id = await ir.json()
          if (id.success) {
            serverImageMsgs.push(id.data)
          } else {
            toast('error', '图片发送失败')
          }
        }
      }

      // Send text message
      let serverMsg: any = null
      if (content.trim()) {
        const r = await fetch('/api/v1/rooms/' + rid + '/messages', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ content: content.trim() }),
        })
        const d = await r.json()
        if (!d.success) {
          if (retryMsgId) {
            setSendFailed(prev => new Map(prev).set(retryMsgId, content))
          } else {
            setSendFailed(prev => new Map(prev).set(tempIds[tempIds.length - 1], content))
            setMessages(p => p.filter(m => !tempIds.includes(m.id)))
            toast('error', d.error?.message_i18n?.zh || '发送失败')
          }
          return
        }
        serverMsg = d.data
      }

      // Replace optimistic messages with real server messages
      if (!retryMsgId) {
        const serverMsgs = [...serverImageMsgs, ...(serverMsg ? [serverMsg] : [])]
        setMessages(p => {
          const result = [...p]
          let serverIdx = 0
          for (let i = 0; i < tempIds.length && serverIdx < serverMsgs.length; i++) {
            const idx = result.findIndex(m => m.id === tempIds[i])
            if (idx !== -1 && result[idx].msg_type === serverMsgs[serverIdx]?.msg_type) {
              // 如果 socket 广播已经先到，删除重复的服务器消息
              const dupIdx = result.findIndex(m => m.id === serverMsgs[serverIdx].id && m.id !== tempIds[i])
              if (dupIdx !== -1) result.splice(dupIdx, 1)
              // 只更新 id 和 _sending，图片内容保持本地 blob URL 不变
              result[idx] = {
                ...result[idx],
                id: serverMsgs[serverIdx].id,
                _sending: false,
              }
              serverIdx++
            }
          }
          return result
        })
      }

      if (retryMsgId) {
        setSendFailed(prev => { const n = new Map(prev); n.delete(retryMsgId); return n })
      }
    } catch {
      const failId = retryMsgId || tempIds[0]
      setSendFailed(prev => new Map(prev).set(failId, content))
      if (!retryMsgId) setMessages(p => p.filter(m => !tempIds.includes(m.id)))
      toast('error', '发送失败，点击叹号重试')
    } finally { setSending(false) }
  }

  const handleImageSelect = (files: FileList | null) => {
    if (!files) return
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    setPendingImages(p => [...p, ...newFiles])
  }

  const removePendingImage = (index: number) => {
    setPendingImages(p => p.filter((_, i) => i !== index))
  }

  const openPhotoSwipe = async (clickedUrl: string) => {
    if (!window.PhotoSwipe || !window.PhotoSwipeLightbox) return

    // Collect all image messages and preload to get dimensions
    const imageMsgs = messages.filter(m => m.msg_type === 'image')
    const imageItems = await Promise.all(imageMsgs.map(m => new Promise<{ src: string; width: number; height: number }>(resolve => {
      const img = new Image()
      img.onload = () => resolve({ src: m.content, width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve({ src: m.content, width: 800, height: 600 })
      img.src = m.content
    })))

    const startIndex = imageItems.findIndex(item => item.src === clickedUrl)

    const lightbox = new window.PhotoSwipeLightbox({
      dataSource: imageItems,
      initialIndex: startIndex >= 0 ? startIndex : 0,
      pswpModule: window.PhotoSwipe,
      maxSpreadZoom: 20,
      secondaryZoomLevel: 2,
      initialZoomLevel: 'fit',
      wheelToZoom: true,
      // 自定义 UI
      closeTitle: '关闭',
      zoomTitle: '缩放',
      arrowPrevTitle: '上一张',
      arrowNextTitle: '下一张',
      errorMsg: '图片加载失败',
    })

    // 添加下载按钮
    lightbox.on('uiRegister', () => {
      lightbox.pswp.ui.registerElement({
        name: 'download',
        order: 8,
        isButton: true,
        tagName: 'button',
        html: {
          isCustomSVG: true,
          size: 24,
          inner: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
          outlineID: 'pswp__icn-download',
        },
        title: '下载图片',
        onClick: () => {
          const pswp = lightbox.pswp
          if (!pswp) return
          const currItem = pswp.currSlide?.data?.src
          if (currItem) {
            const a = document.createElement('a')
            a.href = currItem
            a.download = 'image-' + Date.now() + '.jpg'
            a.target = '_blank'
            a.rel = 'noopener noreferrer'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
          }
        },
      })
    })

    lightbox.init()
    lightbox.loadAndOpen(startIndex >= 0 ? startIndex : 0)
  }

  const joinCall = async () => {
    if (!token || !user) return
    setJoiningCall(true); setCallError(''); setRtcRetryCount(0)
    const attempt = async (retry: number) => {
      try {
        const r = await fetch('/api/v1/rooms/' + rid + '/call/join', { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
        const d = await r.json()
        if (d.success) {
          setInCall(true)
          setCallSid(d.data.call_session_id)
          setRtcReconnecting(false)

          // Join RTC channel
          try {
            const channelId = d.data.rtc_channel || 'room_' + rid
            const uid = d.data.rtc_uid || 'user_' + user.id
            const rtcToken = d.data.rtc_token

            await rtc.join(channelId, uid, rtcToken)
            await rtc.publish(true) // publish with video
            toast('success', '已加入通话')
          } catch (rtcError) {
            console.error('RTC join failed:', rtcError)
            toast('warning', '已加入通话，但音视频连接失败')
          }
        }
        else setCallError(d.error?.message_i18n?.zh || '加入通话失败')
      } catch {
        // PRD 6.11: RTC断线重连 2/4/8秒 最多3次
        if (retry < 3) {
          setRtcReconnecting(true); setRtcRetryCount(retry + 1)
          const delay = Math.pow(2, retry + 1) * 1000 // 2s, 4s, 8s
          setTimeout(() => attempt(retry + 1), delay)
        } else {
          setCallError('网络异常，请刷新页面重试'); setRtcReconnecting(false)
        }
      } finally { setJoiningCall(false) }
    }
    attempt(0)
  }

  const leaveCall = async () => {
    if (!token) return
    setLeavingCall(true)
    try {
      // Stop live translate first
      liveTranslate.stopCapture()
      
      // Leave RTC
      await rtc.leave()

      await fetch('/api/v1/rooms/' + rid + '/call/leave', { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
      setInCall(false); setCallSid(null)
      setSubtitles(new Map())
      toast('success', '已退出通话')
    } finally { setLeavingCall(false) }
  }

  const translateMsg = async (msgId: number) => {
    if (!token || !user) return
    setTranslating(prev => new Set(prev).add(msgId))
    setTranslations(prev => { const n = new Map(prev); n.delete(msgId); return n })
    try {
      const r = await fetch('/api/v1/translate-text-stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ message_id: msgId, target_lang: user.lang_pref }),
      })
      if (!r.ok) {
        const d = await r.json()
        toast('error', d.error?.message_i18n?.zh || '翻译失败')
        return
      }
      const reader = r.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const json = JSON.parse(data)
              if (json.text) {
                fullText += json.text
                setTranslations(prev => new Map(prev).set(msgId, fullText))
              }
            } catch {}
          }
        }
      }
    } catch { toast('error', '翻译失败') } finally { setTranslating(prev => { const n = new Set(prev); n.delete(msgId); return n }) }
  }

  const genSummary = async () => {
    if (!token) return
    setSummaryLoading(true); setShowSummary(true); setSummaryContent('')
    try {
      const r = await fetch('/api/v1/rooms/' + rid + '/summaries', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ time_range_start: summaryTimeStart || undefined, time_range_end: summaryTimeEnd || undefined }),
      })
      const d = await r.json()
      if (d.success) setSummaryContent(d.data.content)
      else setSummaryContent('生成失败：' + (d.error?.message_i18n?.zh || '未知错误'))
    } catch { setSummaryContent('网络错误') } finally { setSummaryLoading(false) }
  }

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-3 text-gray-500">
        <IconSpinner size={20} />
        <span>加载中...</span>
      </div>
    </div>
  )

  if (!room) return <div className="flex h-full items-center justify-center"><p className="text-gray-400"><IconXCircle size={20} className="inline mr-1" />聊天室不存在</p></div>

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-white px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)', boxShadow: '0 1px 4px rgba(26,115,232,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white shrink-0" style={{ background: 'var(--blue-primary)' }}>
            {room.name?.[0]?.toUpperCase() || '#'}
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800">{room.name}</h1>
            <p className="text-xs text-slate-400">{room.members?.length || 0} 名成员 · {room.status === 'active' ? '活跃中' : '已关闭'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!inCall && room.status === 'active' && (
            <button onClick={joinCall} disabled={joiningCall} className="flex items-center gap-1.5 rounded-lg px-3 h-8 text-sm text-white font-medium transition cursor-pointer hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed" style={{ background: '#16a34a' }}>
              {joiningCall ? <><IconSpinner size={15} /> <span>加入中...</span></> : <><IconPhone size={15} /> <span>加入通话</span></>}
            </button>
          )}
          <button onClick={genSummary} disabled={summaryLoading} className="flex items-center gap-1.5 rounded-lg px-3 h-8 text-sm text-slate-600 font-medium transition cursor-pointer hover:bg-blue-50 hover:text-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ border: '1.5px solid var(--border-color)' }}>
            {summaryLoading ? <><IconSpinner size={15} /> <span>生成中...</span></> : <><IconFileText size={15} /> <span>生成纪要</span></>}
          </button>
          <button onClick={() => setShowSettings(true)} className="flex items-center justify-center rounded-lg px-3 h-8 text-sm text-slate-500 transition cursor-pointer hover:bg-blue-50 hover:text-blue-600"
            style={{ border: '1.5px solid var(--border-color)' }}>
            <IconSettings size={15} />
          </button>
        </div>
      </div>

      {/* Call error */}
      {rtcReconnecting && (
        <div className="px-4 py-2 text-sm text-amber-700 flex items-center gap-2" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
          <IconSpinner size={14} /> 通话重连中... (第{rtcRetryCount}次)
        </div>
      )}
      {callError && (
        <div className="px-4 py-2 text-sm text-red-700 flex items-center justify-between" style={{ background: '#fff5f5', borderBottom: '1px solid #fecaca' }}>
          <span className="flex items-center gap-1.5"><IconXCircle size={14} className="text-red-500" /> {callError}</span>
          <button onClick={() => setCallError('')} className="text-red-400 hover:text-red-600 font-medium cursor-pointer">✕</button>
        </div>
      )}

      {/* Call area */}
      {inCall && (
        <CallArea
          participants={room.members || []}
          remoteUsers={rtc.remoteUsers}
          localVideoTrack={rtc.localVideoTrack}
          muted={rtc.muted}
          videoEnabled={rtc.videoEnabled}
          videoToggling={rtc.videoToggling}
          audioLevel={rtc.audioLevel}
          hasCamera={rtc.hasCamera}
          hasMic={rtc.hasMic}
          subtitles={subtitles}
          subtitleFontSize={subtitleFontSize}
          collapsed={callCollapsed}
          onToggleCollapse={() => setCallCollapsed(!callCollapsed)}
          onToggleMute={rtc.toggleMute}
          onToggleVideo={rtc.toggleVideo}
          onLeave={leaveCall}
          leavingCall={leavingCall}
          localUserId={user?.id}
          playRemoteVideo={rtc.playRemoteVideo}
          liveTranslateEnabled={liveTranslate.enabled}
          liveTranslateLoading={liveTranslate.isTranslating}
          onToggleLiveTranslate={liveTranslate.toggle}
        />
      )}

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-auto p-4" style={{ background: 'var(--surface-bg)' }}>
        <div className="mx-auto max-w-3xl space-y-4">
          {loadingMore && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-400">
              <IconSpinner size={16} />
              <span>加载中...</span>
            </div>
          )}
          {messages.map((msg, index) => {
            const isSelf = msg.sender_id === user?.id
            const showDate = index === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString()
            return (
              <div key={msg._clientKey || msg.id}>
                {showDate && (
                  <div className="date-separator">
                    <span>{formatDate(msg.created_at)}</span>
                  </div>
                )}
                <div className={`flex ${isSelf ? 'flex-row-reverse' : 'flex-row'} gap-3 ${!msg._clientKey ? 'animate-bubble-in' : ''} ${msg.msg_type === 'system' ? 'justify-center' : ''}`}>
                {msg.msg_type === 'system' ? (
                  <span className="rounded-full px-3 py-1 text-xs text-slate-400 font-medium" style={{ background: 'var(--border-subtle)' }}>{msg.content}</span>
                ) : (
                  <>
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded" style={{ background: isSelf ? '#95EC69' : 'var(--blue-light)' }}>
                      {msg.sender_avatar ? (
                        <SignedImage src={msg.sender_avatar} alt="" className="h-full w-full object-cover" onLoad={() => shouldScrollRef.current && scrollToBottom()} />
                      ) : (
                        <div className={`flex h-full w-full items-center justify-center text-sm font-semibold ${isSelf ? 'text-green-800' : 'text-[#1a73e8]'}`}>{msg.sender_nickname?.[0] || '?'}</div>
                      )}
                    </div>
                    <div className={`max-w-[70%] min-w-0 ${isSelf ? 'text-right' : 'text-left'}`}>
                      <div className={`flex items-baseline gap-2 ${isSelf ? 'flex-row-reverse' : ''}`}>
                        <span className="text-xs text-slate-400 leading-none">{msg.sender_nickname}</span>
                        <span className="text-xs text-slate-400 leading-none">
                          {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.msg_type === 'voice_transcript' && <span title="语音转写"><IconMic size={12} className="inline text-slate-400" /></span>}
                        {msg._sending && <span className="text-xs text-slate-400 inline-flex items-center gap-1"><IconSpinner size={11} />发送中</span>}
                      </div>
                      {msg.msg_type === 'image' ? (
                        <img src={msg.thumb_url || msg.content} alt="图片" className="mt-1.5 rounded cursor-pointer transition hover:shadow-lg hover:scale-[1.01]"
                          style={{ maxWidth: '200px', maxHeight: '600px', objectFit: 'contain' }} onClick={() => openPhotoSwipe(msg.content)}
                          onLoad={() => shouldScrollRef.current && scrollToBottom()} />
                      ) : (
                        <div className={`inline-block mt-1 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed text-left ${isSelf ? 'bubble-self' : 'bubble-other'}`}>
                          <EmojiText text={msg.content} />
                        </div>
                      )}
                      {translations.has(msg.id) && (
                        <div className={`mt-1.5 rounded-xl px-3 py-2 text-sm font-medium ${isSelf ? 'bubble-self' : 'bubble-other'}`}>
                          {translations.get(msg.id)}
                        </div>
                      )}
                      {!isSelf && (msg.msg_type === 'text' || msg.msg_type === 'voice_transcript') && !translations.has(msg.id) && (
                        <button
                          onClick={() => translateMsg(msg.id)}
                          disabled={translating.has(msg.id)}
                          className="mt-1 flex items-center gap-1 text-xs font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 hover:text-[#1a73e8]"
                        >
                          {translating.has(msg.id) ? (
                            <><IconSpinner size={11} /> {user?.lang_pref === 'en' ? 'Translating...' : user?.lang_pref === 'ja' ? '翻訳中...' : '翻译中...'}</>
                          ) : (
                            <><IconTranslate size={11} /> {user?.lang_pref === 'en' ? 'Translate' : user?.lang_pref === 'ja' ? '翻訳' : '翻译'}</>
                          )}
                        </button>
                      )}
                    </div>
                  </>
                )}
                </div>
              </div>
            )
          })}
          {/* 发送失败 */}
          {Array.from(sendFailed.entries()).map(([id, content]) => (
            <div key={id} className="flex gap-3 justify-end">
              <div className="max-w-[70%]">
                <div className="rounded-xl px-3.5 py-2.5" style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>
                  <div className="flex items-center gap-2">
                    <IconXCircle size={14} className="text-red-500 shrink-0" />
                    <p className="text-sm text-red-700">{content}</p>
                  </div>
                  <button onClick={() => { setSendFailed(prev => { const n = new Map(prev); n.delete(id); return n }); sendMessage(content, id) }}
                    disabled={sending}
                    className="mt-1.5 flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                    {sending ? <><IconSpinner size={11} /> 发送中...</> : <><IconRefresh size={11} /> 重新发送</>}
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      {/* Input */}
      {room.status === 'active' ? (
        <div className="bg-white p-3" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="mx-auto max-w-3xl">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { handleImageSelect(e.target.files); e.target.value = '' }} />
            <RichInput
              onSend={(text) => sendMessage(text)}
              onPasteImages={(files) => setPendingImages(p => [...p, ...files])}
              onImageUpload={() => fileInputRef.current?.click()}
              members={members}
              pendingImages={pendingImages}
              onRemoveImage={removePendingImage}
            />
          </div>
        </div>
      ) : (
        <div className="p-3 text-center text-sm text-slate-400" style={{ borderTop: '1px solid var(--border-color)', background: 'var(--surface-bg)' }}>聊天室已关闭，无法发送消息</div>
      )}

      {/* Summary modal */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowSummary(false)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white rounded-t-2xl px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--blue-light)' }}>
                    <IconFileText size={18} className="text-[#1a73e8]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">会议纪要</h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <IconClock size={12} /> 时间范围：
                      <input type="datetime-local" value={summaryTimeStart} onChange={e => setSummaryTimeStart(e.target.value)}
                        className="rounded-lg px-2 py-1 text-xs outline-none" style={{ border: '1px solid var(--border-color)' }} />
                      <span>至</span>
                      <input type="datetime-local" value={summaryTimeEnd} onChange={e => setSummaryTimeEnd(e.target.value)}
                        className="rounded-lg px-2 py-1 text-xs outline-none" style={{ border: '1px solid var(--border-color)' }} />
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowSummary(false)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"><IconX size={16} /></button>
              </div>
            </div>
            <div className="px-6 py-5">
              {summaryLoading ? (
                <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
                  <IconSpinner size={20} className="text-[#1a73e8]" />
                  <span>正在生成纪要...</span>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-slate-700">{summaryContent}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Room settings modal */}
      <RoomSettingsModal
        rid={rid}
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSaved={fetchRoom}
      />

      {/* PhotoSwipe */}
      <link rel="stylesheet" href="/css/photoswipe.css" />
      <link rel="stylesheet" href="/css/photoswipe-custom.css" />
      <Script src="/js/photoswipe-init.js" strategy="lazyOnload" type="module" />
    </div>
  )
}
