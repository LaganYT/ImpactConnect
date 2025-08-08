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
    <html lang="en" suppressHydrationWarning data-theme="light">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var theme=(t&&t!=='system')?t:(m?'dark':'light');document.documentElement.setAttribute('data-theme', theme);}catch(e){}})()",
          }}
        />
        {children}
      </body>
    </html>
  )
}
