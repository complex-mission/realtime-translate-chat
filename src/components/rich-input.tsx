'use client'
import { useState, useRef, useCallback, useEffect, type KeyboardEvent, type ClipboardEvent } from 'react'
import { EMOJI_LIST, EMOJI_NAMES } from '@/lib/emoji-data'
import { IconX } from '@/components/ui/icon'

interface Member {
  user_id: number
  nickname: string
  avatar_url: string
}

interface RichInputProps {
  onSend: (text: string) => void
  onPasteImages: (files: File[]) => void
  onImageUpload?: () => void
  members: Member[]
  pendingImages?: File[]
  onRemoveImage?: (index: number) => void
  disabled?: boolean
  maxLength?: number
}

export default function RichInput({ onSend, onPasteImages, onImageUpload, members, pendingImages = [], onRemoveImage, disabled, maxLength = 5000 }: RichInputProps) {
  const hasPendingImages = pendingImages.length > 0
  const editorRef = useRef<HTMLDivElement>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showMention, setShowMention] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const emojiRef = useRef<HTMLDivElement>(null)
  const mentionRef = useRef<HTMLDivElement>(null)
  const [hasContent, setHasContent] = useState(false)
  const canSend = hasPendingImages || hasContent

  const getPlainText = useCallback(() => {
    const el = editorRef.current
    if (!el) return ''
    let text = ''
    const walk = (node: ChildNode) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent
      } else if (node instanceof HTMLSpanElement && node.classList.contains('mention')) {
        text += node.textContent
      } else if (node instanceof HTMLBRElement) {
        text += '\n'
      } else {
        node.childNodes.forEach(walk)
      }
    }
    walk(el)
    return text.replace(/\n$/, '')
  }, [])

  const insertEmoji = useCallback((emoji: string) => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    document.execCommand('insertText', false, emoji)
    setShowEmoji(false)
    setHasContent(true)
  }, [])

  const insertMention = useCallback((member: Member) => {
    const el = editorRef.current
    if (!el) return
    el.focus()

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    const range = sel.getRangeAt(0)
    const textNode = range.startContainer
    if (textNode.nodeType !== Node.TEXT_NODE) return

    const text = textNode.textContent || ''
    const cursorPos = range.startOffset
    const atIndex = text.lastIndexOf('@', cursorPos - 1)
    if (atIndex === -1) return

    const before = text.slice(0, atIndex)
    const after = text.slice(cursorPos)

    const mentionSpan = document.createElement('span')
    mentionSpan.className = 'mention'
    mentionSpan.contentEditable = 'false'
    mentionSpan.dataset.userId = String(member.user_id)
    mentionSpan.textContent = `@${member.nickname}`
    mentionSpan.style.cssText = 'color: var(--blue-primary); background: var(--blue-light); padding: 1px 4px; border-radius: 4px; font-weight: 500;'

    const beforeNode = document.createTextNode(before)
    const afterNode = document.createTextNode('\u00A0' + after)

    const parent = textNode.parentNode!
    parent.insertBefore(beforeNode, textNode)
    parent.insertBefore(mentionSpan, textNode)
    parent.insertBefore(afterNode, textNode)
    parent.removeChild(textNode)

    const newRange = document.createRange()
    newRange.setStart(afterNode, 1)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)

    setShowMention(false)
    setMentionFilter('')
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (showMention) {
      const filtered = members.filter(m => m.nickname.toLowerCase().includes(mentionFilter.toLowerCase()))
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex(i => (i + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex(i => (i - 1 + filtered.length) % filtered.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (filtered[mentionIndex]) insertMention(filtered[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowMention(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const text = getPlainText()
      if (text.trim() || hasPendingImages) {
        onSend(text)
        if (editorRef.current) {
          editorRef.current.innerHTML = ''
        }
        setHasContent(false)
      }
    }
  }, [showMention, mentionFilter, mentionIndex, members, insertMention, onSend, getPlainText, hasPendingImages])

  const handleInput = useCallback(() => {
    const text = editorRef.current?.textContent?.trim() || ''
    setHasContent(!!text)

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    const range = sel.getRangeAt(0)
    const textNode = range.startContainer
    if (textNode.nodeType !== Node.TEXT_NODE) return

    const nodeText = textNode.textContent || ''
    const cursorPos = range.startOffset
    const beforeCursor = nodeText.slice(0, cursorPos)
    const atIndex = beforeCursor.lastIndexOf('@')

    if (atIndex !== -1 && (atIndex === 0 || beforeCursor[atIndex - 1] === ' ' || beforeCursor[atIndex - 1] === '\u00A0')) {
      const query = beforeCursor.slice(atIndex + 1)
      if (!query.includes(' ')) {
        setMentionFilter(query)
        setShowMention(true)
        setMentionIndex(0)
        return
      }
    }
    setShowMention(false)
  }, [])

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles: File[] = []
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault()
      onPasteImages(imageFiles)
      return
    }

    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!text) return

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    const range = sel.getRangeAt(0)
    range.deleteContents()

    const lines = text.split('\n')
    const frag = document.createDocumentFragment()
    lines.forEach((line, i) => {
      if (i > 0) frag.appendChild(document.createElement('br'))
      if (line) frag.appendChild(document.createTextNode(line))
    })

    range.insertNode(frag)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  }, [onPasteImages])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredMembers = members.filter(m => m.nickname.toLowerCase().includes(mentionFilter.toLowerCase()))

  return (
    <div className="relative flex-1">
      <div className="rounded-2xl transition-all" style={{ border: '1.5px solid var(--border-color)', background: 'white' }}>
        {/* 图片预览 */}
        {hasPendingImages && (
          <div className="flex gap-2 p-3 pb-0 overflow-x-auto rounded-t-2xl">
            {pendingImages.map((file, i) => (
              <div key={i} className="relative group shrink-0">
                <img
                  src={URL.createObjectURL(file)}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover"
                  style={{ border: '1px solid var(--border-color)' }}
                />
                <button
                  onClick={() => onRemoveImage?.(i)}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition cursor-pointer"
                  type="button"
                >
                  <IconX size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 文本编辑区域 */}
        <div className="relative">
          <div
            ref={editorRef}
            contentEditable={!disabled}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className="px-4 py-2.5 text-sm text-slate-800 outline-none transition overflow-auto leading-relaxed empty:before:content-['输入消息…'] empty:before:text-slate-400 empty:before:pointer-events-none"
            style={{
              minHeight: '24px',
              maxHeight: '30vh',
              wordBreak: 'break-word',
            }}
            role="textbox"
            aria-multiline="true"
          />
          {showMention && filteredMembers.length > 0 && (
            <div
              ref={mentionRef}
              className="absolute bottom-full left-2 mb-1 z-50 bg-white rounded-xl shadow-xl border w-[200px] max-h-[200px] overflow-auto"
              style={{ borderColor: 'var(--border-color)' }}
            >
              {filteredMembers.map((member, i) => (
                <div
                  key={member.user_id}
                  onClick={() => insertMention(member)}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition ${i === mentionIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                    {member.nickname[0]}
                  </div>
                  <span className="text-sm text-slate-700">{member.nickname}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 工具栏和发送按钮 */}
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-0.5">
            {/* 图片上传按钮 */}
            {onImageUpload && (
              <button
                onClick={onImageUpload}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-sm transition cursor-pointer hover:bg-gray-100 text-slate-500"
                title="上传图片"
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>
            )}
            {/* 表情按钮 - 与图片按钮风格一致 */}
            <div className="relative" ref={emojiRef}>
              <button
                onClick={() => setShowEmoji(!showEmoji)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-sm transition cursor-pointer hover:bg-gray-100 text-slate-500"
                title="表情"
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                  <line x1="9" y1="9" x2="9.01" y2="9"/>
                  <line x1="15" y1="9" x2="15.01" y2="9"/>
                </svg>
              </button>
              {/* 表情面板 */}
              {showEmoji && (
                <div className="absolute bottom-full left-0 mb-2 z-50 bg-white rounded-xl shadow-xl border p-2 w-[280px]"
                  style={{ borderColor: 'var(--border-color)' }}>
                  <div className="grid grid-cols-10 gap-0.5">
                    {EMOJI_LIST.map((emoji, i) => (
                      <button
                        key={i}
                        onMouseDown={(e) => { e.preventDefault(); insertEmoji(emoji); }}
                        className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded cursor-pointer transition text-lg"
                        title={EMOJI_NAMES[emoji] || emoji}
                        type="button"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 发送按钮 */}
          <button
            onClick={() => {
              const text = getPlainText()
              if (canSend) {
                onSend(text)
                if (editorRef.current) editorRef.current.innerHTML = ''
                setHasContent(false)
              }
            }}
            disabled={!canSend}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition cursor-pointer ${
              canSend
                ? 'text-white hover:opacity-90'
                : 'text-slate-300 cursor-not-allowed'
            }`}
            style={{ background: canSend ? 'var(--blue-primary)' : 'var(--border-subtle)' }}
            title="发送 (Enter)"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
