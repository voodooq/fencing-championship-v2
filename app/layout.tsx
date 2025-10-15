import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '赛事成绩',
  description: 'Created with YYSport',
  generator: 'YYSport',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
