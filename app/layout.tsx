import type { Metadata } from 'next'
import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'ניהול לקוחות - נחמיה דרוק',
  description: 'לוח בקרה לניהול לקוחות יועץ פיננסי',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  )
}

