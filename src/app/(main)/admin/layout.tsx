import type { Metadata } from 'next'

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'CM会议平台'

export const metadata: Metadata = {
  title: {
    default: '管理后台',
    template: `%s | 管理后台 | ${appName}`
  },
  description: `${appName}管理后台，管理用户、聊天室、术语表等。`,
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}