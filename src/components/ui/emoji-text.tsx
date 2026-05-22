'use client'

interface EmojiTextProps {
  text: string
  className?: string
}

const URL_REGEX = /(https?:\/\/[^\s<]+)/g
const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu

function parseText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let keyIndex = 0

  const lines = text.split('\n')
  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) parts.push(<br key={`br${keyIndex++}`} />)
    if (!line) return

    const urlRegex = new RegExp(URL_REGEX.source, 'gu')
    let match: RegExpExecArray | null
    let lastIdx = 0

    while ((match = urlRegex.exec(line)) !== null) {
      if (match.index > lastIdx) {
        parts.push(processEmoji(line.slice(lastIdx, match.index), keyIndex))
        keyIndex += 100
      }

      const url = match[0]
      parts.push(
        <a
          key={`u${keyIndex++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {url}
        </a>
      )

      lastIdx = match.index + url.length
    }

    if (lastIdx < line.length) {
      parts.push(processEmoji(line.slice(lastIdx, line.length), keyIndex))
    }
  })

  return parts
}

function processEmoji(text: string, baseKey: number): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const emojiRegex = new RegExp(EMOJI_REGEX.source, 'gu')
  let match: RegExpExecArray | null
  let lastIdx = 0

  while ((match = emojiRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index))
    }
    parts.push(
      <span key={`e${baseKey++}`} className="emoji-large">
        {match[0]}
      </span>
    )
    lastIdx = match.index + match[0].length
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx))
  }

  return parts
}

export default function EmojiText({ text, className }: EmojiTextProps) {
  if (!text) return null
  return <span className={className}>{parseText(text)}</span>
}
