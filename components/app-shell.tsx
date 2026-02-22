'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { Button } from '@/components/ui/button'
import { GlobalChatListener } from '@/components/chat/global-chat-listener'
import { cn } from '@/lib/utils'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
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
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <GlobalChatListener />

      {/* Mobile Sidebar Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-navy/40 backdrop-blur-sm transition-all duration-500 md:hidden",
          isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar aside */}
      <aside
        id="app-sidebar"
        className={cn(
          "fixed inset-y-0 right-0 z-50 transform transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] md:static md:translate-x-0 overflow-hidden",
          isSidebarCollapsed ? "md:w-20" : "md:w-72",
          isSidebarOpen ? "translate-x-0 w-72" : "translate-x-full"
        )}
      >
        <Sidebar onClose={() => setIsSidebarOpen(false)} isCollapsed={isSidebarCollapsed} />
      </aside>

      {/* Main Content */}
      <main className="relative flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Glass Header */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between px-6 md:px-10 bg-white/70 backdrop-blur-xl border-b border-slate-200/50">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="md:hidden h-11 w-11 rounded-2xl bg-slate-100 text-navy hover:bg-slate-200 transition-all active:scale-95"
              aria-label={isSidebarOpen ? "סגור תפריט" : "פתח תפריט"}
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="hidden md:flex h-11 w-11 rounded-2xl bg-slate-100 text-navy hover:bg-slate-200 transition-all active:scale-95"
              aria-label={isSidebarCollapsed ? "הרחב תפריט" : "צמצם תפריט"}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="hidden md:flex flex-col">
              <h2 className="text-sm font-black text-navy tracking-tight">מערכת ניהול לקוחות</h2>
              <p className="text-[10px] font-bold text-grey uppercase tracking-widest">נחמיה דרוק - פתרונות פיננסיים</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Dynamic search or user profile could go here */}
            <div className="h-10 px-4 rounded-xl bg-slate-100/50 border border-slate-200/50 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">מחובר כעת</span>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-20">
          {children}
        </div>
      </main>
    </div>
  )
}
