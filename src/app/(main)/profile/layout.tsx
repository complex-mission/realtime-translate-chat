import type { Metadata } from 'next'

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'CM会议平台'

export const metadata: Metadata = {
  title: '个人设置',
  description: `管理您的${appName}个人资料和设置。`,
  robots: {
    index: false,
    follow: false,
  },
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}