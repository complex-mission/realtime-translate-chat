import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '术语表',
}

export default function GlossaryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}