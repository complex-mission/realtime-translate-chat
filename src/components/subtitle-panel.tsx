'use client'
import { useState } from 'react'
import { IconTranslate, IconChevronDown, IconChevronUp, IconX } from '@/components/ui/icon'
import SignedImage from '@/components/ui/signed-image'

interface SubtitlePanelProps {
  subtitles: Map<number, { text: string; translated: string; targetLang?: string }>
  participants: { user_id: number; nickname: string; avatar_url?: string | null }[]
  subtitleFontSize: 'sm' | 'base' | 'lg'
  enabled: boolean
  onToggle: () => void
  onClose: () => void
}

export default function SubtitlePanel({
  subtitles,
  participants,
  subtitleFontSize,
  enabled,
  onToggle,
  onClose
}: SubtitlePanelProps) {
  const [minimized, setMinimized] = useState(false)

  if (!enabled) return null

  return (
    <div 
      className="fixed bottom-4 right-4 z-50"
      style={{ maxHeight: minimized ? '48px' : '400px', width: '320px' }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between bg-purple-600 text-white px-3 py-2 rounded-t-xl cursor-pointer"
        onClick={() => setMinimized(!minimized)}
        style={{ borderRadius: minimized ? '24px' : '12px 12px 0 0' }}
      >
        <div className="flex items-center gap-2">
          <IconTranslate size={16} />
          <span className="text-sm font-medium">同传翻译</span>
          {subtitles.size > 0 && (
            <span className="bg-purple-500 text-xs px-1.5 py-0.5 rounded-full">
              {subtitles.size}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!minimized && (
            <button 
              onClick={(e) => { e.stopPropagation(); setMinimized(true) }}
              className="p-1 hover:bg-purple-500 rounded transition"
            >
              <IconChevronDown size={14} />
            </button>
          )}
          {minimized && (
            <button 
              onClick={(e) => { e.stopPropagation(); setMinimized(false) }}
              className="p-1 hover:bg-purple-500 rounded transition"
            >
              <IconChevronUp size={14} />
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

      {/* Content */}
      {!minimized && (
        <div 
          className="bg-white rounded-b-xl shadow-lg overflow-hidden"
          style={{ 
            border: '1px solid #e9d5ff',
            borderTop: 'none',
            maxHeight: '350px'
          }}
        >
          <div className="p-3 overflow-y-auto" style={{ maxHeight: '350px' }}>
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
                <p className="text-xs text-purple-400">等待翻译...</p>
                <p className="text-[10px] text-purple-300 mt-1">当有人说话时将自动翻译</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
