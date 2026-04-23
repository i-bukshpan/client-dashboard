import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nehemiah OS | מערכת ניהול עסקית',
  description: 'מערכת ניהול עסקית מקצועית לנחמיה דרוק, יועץ פיננסי.',
}

import { Toaster } from 'sonner'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
        <Toaster position="bottom-left" richColors />
      </body>
    </html>
  )
}

