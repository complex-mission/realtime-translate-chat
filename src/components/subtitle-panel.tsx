'use client'
import { useState } from 'react'
import { IconTranslate, IconX, IconSpinner } from '@/components/ui/icon'
import SignedImage from '@/components/ui/signed-image'
import type { DebugInfo } from '@/hooks/useLiveTranslate'

interface SubtitlePanelProps {
  subtitles: Map<number, { text: string; translated: string; targetLang?: string }>
  participants: { user_id: number; nickname: string; avatar_url?: string | null }[]
  subtitleFontSize: 'sm' | 'base' | 'lg'
  isTranslating: boolean
  inCall: boolean
  debugInfo: DebugInfo
  onClose: () => void
  onToggleTranslate: () => void
}

export default function SubtitlePanel({
  subtitles,
  participants,
  subtitleFontSize,
  isTranslating,
  inCall,
  debugInfo,
  onClose,
  onToggleTranslate
}: SubtitlePanelProps) {
  const [minimized, setMinimized] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  return (
    <div 
      className="fixed bottom-20 right-4 md:bottom-4 z-50"
      style={{ maxHeight: minimized ? '48px' : '500px', width: '320px' }}
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
          {!isTranslating && subtitles.size > 0 && (
            <span className="bg-purple-500 text-xs px-1.5 py-0.5 rounded-full">
              {subtitles.size}
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
        <div className="bg-gray-900 text-green-400 px-3 py-2 text-[10px] font-mono overflow-auto" style={{ maxHeight: '150px' }}>
          <div className="text-yellow-400 mb-1">-- Debug Info --</div>
          <div>Status: {debugInfo.status}</div>
          <div>Source: {debugInfo.audioSource}</div>
          <div>Chunks: {debugInfo.chunksReceived} (last: {debugInfo.lastChunkSize}b)</div>
          {debugInfo.lastApiCall && <div>API Call: {debugInfo.lastApiCall}</div>}
          {debugInfo.lastApiResult && <div>API Result: {debugInfo.lastApiResult}</div>}
          {debugInfo.lastError && <div className="text-red-400">Error: {debugInfo.lastError}</div>}
        </div>
      )}

      {/* Content */}
      {!minimized && (
        <div 
          className="bg-white rounded-b-xl shadow-lg overflow-hidden"
          style={{ 
            border: '1px solid #e9d5ff',
            borderTop: 'none',
            maxHeight: showDebug ? '300px' : '350px'
          }}
        >
          {/* Translate toggle button - only show when in call */}
          {inCall && (
            <div className="px-3 py-2" style={{ borderBottom: '1px solid #f3e8ff' }}>
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

          {/* Subtitles list */}
          <div className="p-3 overflow-y-auto" style={{ maxHeight: inCall ? '290px' : '340px' }}>
            {subtitles.size > 0 ? (
              Array.from(subtitles.entries()).map(([userId, sub]) => {
                const participant = participants.find(p => p.user_id === userId)
                const nickname = participant?.nickname || `用户${userId}`
                
                return (
                  <div key={userId} className="mb-3 last:mb-0 pb-3" style={{ borderBottom: '1px solid #f3e8ff' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="h-5 w-5 rounded-full overflow-hidden bg-purple-100 flex items-center justify-center">
                        {participant?.avatar_url ? (
                          <SignedImage src={participant.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[9px] font-bold text-purple-600">{nickname[0]}</span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-purple-600">{nickname}</span>
                    </div>
                    {sub.translated && (
                      <p className={`font-medium pl-6 ${
                        subtitleFontSize === 'sm' ? 'text-xs' : subtitleFontSize === 'lg' ? 'text-base' : 'text-sm'
                      }`} style={{ color: 'var(--blue-hover)' }}>
                        {sub.translated}
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
