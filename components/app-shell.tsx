'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { Button } from '@/components/ui/button'
import { GlobalChatListener } from '@/components/chat/global-chat-listener'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()
  const isPublicView = pathname?.startsWith('/view')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const applyMatch = () => setIsSidebarOpen(mediaQuery.matches)
    applyMatch()
    mediaQuery.addEventListener('change', applyMatch)
    return () => mediaQuery.removeEventListener('change', applyMatch)
  }, [])

  if (isPublicView) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <GlobalChatListener />
      <div
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity md:hidden ${isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />
      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 right-0 z-40 w-64 transform transition-transform duration-200 ease-out md:static md:translate-x-0 md:transition-none ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:hidden'
          }`}
      >
        <Sidebar />
      </aside>
      <main className="relative flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white/90 px-4 py-3 shadow-sm backdrop-blur md:justify-start">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="gap-2 rounded-full border-slate-200 bg-white/80 px-4 shadow-sm hover:bg-white"
            aria-pressed={isSidebarOpen}
            aria-controls="app-sidebar"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white">
              {isSidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </span>
            <span className="hidden sm:inline">
              {isSidebarOpen ? 'הסתר תפריט' : 'הצג תפריט'}
            </span>
          </Button>
        </div>
        {children}
      </main>
    </div>
  )
}
