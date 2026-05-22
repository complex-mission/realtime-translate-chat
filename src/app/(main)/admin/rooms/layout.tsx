import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '聊天室管理',
}

export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}