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
        {/* PWA Settings */}
        <link rel="manifest" href="/worker-manifest.json" />
        <meta name="theme-color" content="#f97316" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="נחמיה" />
        <link rel="apple-touch-icon" href="/worker-icon-192.png" />
      </head>
      <body className="antialiased">
        {children}
        <Toaster position="bottom-left" richColors />
        
        {/* Service Worker Registration */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(reg) {
                console.log('PWA Service Worker Registered');
              }).catch(function(err) {
                console.error('PWA Service Worker Failed', err);
              });
            });
          }
        `}} />
      </body>
    </html>
  )
}

