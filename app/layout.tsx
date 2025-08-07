import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ImpactConnect - Modern Chat Application',
  description: 'A real-time chat application built with Next.js and Supabase',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
