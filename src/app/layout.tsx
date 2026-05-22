import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'
import { DialogProvider } from '@/components/ui/dialog'

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'CM会议平台'
const appDescription = process.env.NEXT_PUBLIC_APP_DESCRIPTION || '实时翻译智能协作会议系统'

export const metadata: Metadata = {
  title: {
    default: `${appName} - ${appDescription}`,
    template: `%s | ${appName}`
  },
  description: `${appName}是一款支持多语言实时翻译的智能语音会议系统，提供高清语音通话、实时字幕翻译、智能会议纪要等功能，让全球团队无缝协作。`,
  keywords: ['会议平台', '实时翻译', '语音会议', '视频会议', '在线会议', '远程协作', '会议纪要', '多语言翻译'],
  authors: [{ name: appName }],
  creator: appName,
  publisher: appName,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://meeting.example.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: '/',
    title: `${appName} - ${appDescription}`,
    description: `支持多语言实时翻译的智能语音会议系统，让全球团队无缝协作。`,
    siteName: appName,
    images: [
      {
        url: '/img/icon-1280.png',
        width: 1280,
        height: 1280,
        alt: appName,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${appName} - ${appDescription}`,
    description: `支持多语言实时翻译的智能语音会议系统，让全球团队无缝协作。`,
    images: ['/img/icon-1280.png'],
  },
  icons: {
    icon: [
      { url: '/img/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/img/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/img/favicon-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/img/favicon-128.png', sizes: '128x128', type: 'image/png' },
    ],
    shortcut: '/img/favicon-32.png',
    apple: [
      { url: '/img/favicon-180.png', sizes: '180x180', type: 'image/png' },
      { url: '/img/favicon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: '/img/favicon-180.png',
      },
    ],
  },
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <head>
        <link rel="icon" href="/img/favicon-32.png" sizes="32x32" />
        <link rel="icon" href="/img/favicon-16.png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/img/favicon-180.png" sizes="180x180" />
        <meta name="theme-color" content="#1e40af" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: appName,
              description: '支持多语言实时翻译的智能语音会议系统',
              url: process.env.NEXT_PUBLIC_SITE_URL || 'https://meeting.example.com',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'CNY',
              },
              featureList: [
                '多语言实时翻译',
                '高清语音会议',
                '智能会议纪要',
                '实时字幕',
                '多人协作',
              ],
              screenshot: '/img/icon-1280.png',
              author: {
                '@type': 'Organization',
                name: appName,
              },
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-white font-sans antialiased">
        <ToastProvider>
          <DialogProvider>
            {children}
          </DialogProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
