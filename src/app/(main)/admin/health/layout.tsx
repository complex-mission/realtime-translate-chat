import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '系统健康',
}

export default function HealthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}