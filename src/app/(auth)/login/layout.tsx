import type { Metadata } from 'next'

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'CM会议平台'

export const metadata: Metadata = {
  title: '登录',
  description: `登录${appName}，开始实时翻译智能协作会议体验。`,
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}