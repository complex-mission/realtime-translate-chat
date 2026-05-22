import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '消息检索',
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}