import type { Metadata } from 'next'

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'CM会议平台'

export const metadata: Metadata = {
  title: '聊天室',
  description: `${appName}聊天室，支持多语言实时翻译、语音会议、智能会议纪要等功能。`,
  robots: {
    index: false,
    follow: false,
  },
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}