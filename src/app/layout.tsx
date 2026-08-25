import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'נחמיה OS | מערכת ניהול עסקית',
  description: 'מערכת ניהול עסקית מקצועית לנחמיה דרוק, יועץ פיננסי.',
  manifest: '/worker-manifest.json',
  themeColor: '#f97316',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'נחמיה',
  },
}

import { Toaster } from 'sonner'
import { AuthRecoveryListener } from '@/components/auth/AuthRecoveryListener'

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
        <AuthRecoveryListener />
        {children}
        <Toaster position="bottom-left" richColors />
        
        {/* Service Worker Registration */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function() {
                console.log('PWA Ready');
              }).catch(function(err) {
                console.error('PWA Error', err);
              });
            });
          }
        `}} />
      </body>
    </html>
  )
}

