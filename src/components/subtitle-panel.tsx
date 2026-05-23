'use client'
import { useState, useRef, useEffect } from 'react'
import { IconTranslate, IconX, IconSpinner } from '@/components/ui/icon'
import SignedImage from '@/components/ui/signed-image'
import type { DebugInfo } from '@/hooks/useLiveTranslate'

interface SubtitleEntry {
  id: number
  userId: number
  translated: string
  targetLang?: string
  timestamp: number
}

interface SubtitlePanelProps {
  subtitles: SubtitleEntry[]
  participants: { user_id: number; nickname: string; avatar_url?: string | null }[]
  subtitleFontSize: 'sm' | 'base' | 'lg'
  isTranslating: boolean
  inCall: boolean
  debugInfo: DebugInfo
  hasMore: boolean
  loading: boolean
  onClose: () => void
  onToggleTranslate: () => void
  onLoadMore: () => void
}

export default function SubtitlePanel({
  subtitles,
  participants,
  subtitleFontSize,
  isTranslating,
  inCall,
  debugInfo,
  hasMore,
  loading,
  onClose,
  onToggleTranslate,
  onLoadMore
}: SubtitlePanelProps) {
  const [minimized, setMinimized] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevSubtitlesLengthRef = useRef(0)
  const isLoadingMoreRef = useRef(false)
  const scrollHeightBeforeRef = useRef(0)

  // Handle scroll to load more
  const handleScroll = () => {
    const el = scrollRef.current
    if (!el || loading || !hasMore || isLoadingMoreRef.current) return
    
    // Load more when scrolled to top (within 100px)
    if (el.scrollTop < 100) {
      scrollHeightBeforeRef.current = el.scrollHeight
      isLoadingMoreRef.current = true
      onLoadMore()
    }
  }

  // Maintain scroll position after loading more
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    
    if (subtitles.length > prevSubtitlesLengthRef.current) {
      if (isLoadingMoreRef.current) {
        // We just loaded more older translations - maintain position
        const scrollHeightAfter = el.scrollHeight
        const heightDiff = scrollHeightAfter - scrollHeightBeforeRef.current
        el.scrollTop = el.scrollTop + heightDiff
        isLoadingMoreRef.current = false
        scrollHeightBeforeRef.current = 0
      } else if (prevSubtitlesLengthRef.current === 0) {
        // Initial load - scroll to bottom
        setTimeout(() => {
          el.scrollTop = el.scrollHeight
        }, 50)
      }
    }
    
    prevSubtitlesLengthRef.current = subtitles.length
  }, [subtitles.length])

  // Reset isLoadingMoreRef when loading completes
  useEffect(() => {
    if (!loading) {
      // isLoadingMoreRef.current = false
    }
  }, [loading])

  // Get participant info for a userId
  const getParticipant = (userId: number) => {
    return participants.find(p => p.user_id === userId)
  }

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div 
      className="fixed bottom-20 right-4 md:bottom-4 z-50"
      style={{ maxHeight: minimized ? '48px' : '70vh', width: '350px' }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between bg-purple-600 text-white px-3 py-2 cursor-pointer"
        onClick={() => setMinimized(!minimized)}
        style={{ borderRadius: minimized ? '24px' : '12px 12px 0 0' }}
      >
        <div className="flex items-center gap-2">
          <IconTranslate size={16} />
          <span className="text-sm font-medium">同传翻译</span>
          {isTranslating && (
            <span className="flex items-center gap-1 text-xs bg-purple-500 px-1.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              翻译中
            </span>
          )}
          {!isTranslating && subtitles.length > 0 && (
            <span className="bg-purple-500 text-xs px-1.5 py-0.5 rounded-full">
              {subtitles.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!minimized && (
            <button 
              onClick={(e) => { e.stopPropagation(); setShowDebug(!showDebug) }}
              className={`p-1 rounded transition ${showDebug ? 'bg-purple-400' : 'hover:bg-purple-500'}`}
              title="调试信息"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </button>
          )}
          {!minimized && (
            <button 
              onClick={(e) => { e.stopPropagation(); setMinimized(true) }}
              className="p-1 hover:bg-purple-500 rounded transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          )}
          {minimized && (
            <button 
              onClick={(e) => { e.stopPropagation(); setMinimized(false) }}
              className="p-1 hover:bg-purple-500 rounded transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="p-1 hover:bg-purple-500 rounded transition"
          >
            <IconX size={14} />
          </button>
        </div>
      </div>

      {/* Debug Info */}
      {!minimized && showDebug && (
        <div className="bg-gray-900 text-green-400 px-3 py-2 text-[10px] font-mono overflow-auto" style={{ maxHeight: '120px' }}>
          <div className="text-yellow-400 mb-1">-- Debug Info --</div>
          <div>Status: {debugInfo.status}</div>
          <div>Source: {debugInfo.audioSource}</div>
          <div>Chunks: {debugInfo.chunksReceived}</div>
          <div>Audio Level: {debugInfo.audioLevel}</div>
          <div>Silence: {debugInfo.silenceDetected ? 'Yes' : 'No'}</div>
          {debugInfo.lastError && <div className="text-red-400">Error: {debugInfo.lastError}</div>}
        </div>
      )}

      {/* Content */}
      {!minimized && (
        <div 
          className="bg-white rounded-b-xl shadow-lg overflow-hidden flex flex-col"
          style={{ 
            border: '1px solid #e9d5ff',
            borderTop: 'none',
            maxHeight: showDebug ? 'calc(60vh - 120px)' : '60vh'
          }}
        >
          {/* Translate toggle button - only show when in call */}
          {inCall && (
            <div className="px-3 py-2 border-b border-purple-100 flex-shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleTranslate() }}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${
                  isTranslating
                    ? 'bg-purple-100 text-purple-600 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {isTranslating ? (
                  <>
                    <IconSpinner size={14} />
                    <span>翻译中...</span>
                  </>
                ) : (
                  <>
                    <IconTranslate size={14} />
                    <span>开始同传翻译</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center justify-center py-2 text-purple-500 flex-shrink-0">
              <IconSpinner size={14} className="mr-2" />
              <span className="text-xs">加载历史记录...</span>
            </div>
          )}

          {/* Subtitles list - scrollable */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3"
            style={{ minHeight: '200px' }}
            onScroll={handleScroll}
          >
            {/* Load more indicator */}
            {hasMore && !loading && subtitles.length > 0 && (
              <div className="text-center py-2 mb-2">
                <button 
                  onClick={onLoadMore}
                  className="text-xs text-purple-500 hover:text-purple-700"
                >
                  ↑ 加载更早的翻译
                </button>
              </div>
            )}
            
            {subtitles.length > 0 ? (
              subtitles.map((entry) => {
                const participant = getParticipant(entry.userId)
                const nickname = participant?.nickname || `用户${entry.userId}`
                
                return (
                  <div key={entry.id} className="mb-3 last:mb-0 pb-3" style={{ borderBottom: '1px solid #f3e8ff' }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full overflow-hidden bg-purple-100 flex items-center justify-center">
                          {participant?.avatar_url ? (
                            <SignedImage src={participant.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-[9px] font-bold text-purple-600">{nickname[0]}</span>
                          )}
                        </div>
                        <span className="text-xs font-medium text-purple-600">{nickname}</span>
                      </div>
                      <span className="text-[10px] text-gray-400">{formatTime(entry.timestamp)}</span>
                    </div>
                    {entry.translated && (
                      <p className={`font-medium pl-6 ${
                        subtitleFontSize === 'sm' ? 'text-xs' : subtitleFontSize === 'lg' ? 'text-base' : 'text-sm'
                      }`} style={{ color: 'var(--blue-hover)' }}>
                        {entry.translated}
                      </p>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="text-center py-6">
                <IconTranslate size={24} className="mx-auto text-purple-300 mb-2" />
                <p className="text-xs text-purple-400">
                  {inCall ? '等待翻译...' : '暂无翻译记录'}
                </p>
                <p className="text-[10px] text-purple-300 mt-1">
                  {inCall ? '开启同传翻译后将自动显示' : '加入通话后可开启同传翻译'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
