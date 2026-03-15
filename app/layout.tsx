import type { Metadata } from 'next'
import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'ניהול לקוחות - נחמיה דרוק',
  description: 'לוח בקרה לניהול לקוחות יועץ פיננסי',

  verification: {
    google: 'l8WaFghdXmZaPbsSFdAETbM1FN2CWNpaX1H1lmZqf_A',
  },
}

import { CommandPalette } from '@/components/command-palette'
import { GlobalAIAccess } from '@/components/global-ai-access'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body>
        <ToastProvider>
          <Toaster richColors position="top-center" dir="rtl" />
          <CommandPalette />
          <AppShell>{children}</AppShell>
          <GlobalAIAccess />
        </ToastProvider>
      </body>
    </html>
  )
}

