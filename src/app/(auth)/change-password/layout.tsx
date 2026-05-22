import type { Metadata } from 'next'

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'CM会议平台'

export const metadata: Metadata = {
  title: '修改密码',
  description: `修改您的${appName}账户密码。`,
  robots: {
    index: false,
    follow: false,
  },
}

export default function ChangePasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}