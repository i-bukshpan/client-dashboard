'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X, Search } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { Button } from '@/components/ui/button'
import { GlobalChatListener } from '@/components/chat/global-chat-listener'
import { ThemeToggle } from '@/components/theme-toggle'
import { GlobalSearch } from '@/components/global-search'
import { NotificationCenter } from '@/components/notification-center'
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
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC] dark:bg-[hsl(222,47%,8%)] transition-colors duration-300">
      <GlobalChatListener />

      {/* Mobile Sidebar Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-navy/40 dark:bg-black/60 backdrop-blur-sm transition-all duration-500 md:hidden",
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
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between px-6 md:px-10 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/30 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="md:hidden h-11 w-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-navy hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
              aria-label={isSidebarOpen ? "סגור תפריט" : "פתח תפריט"}
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="hidden md:flex h-11 w-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-navy hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
              aria-label={isSidebarCollapsed ? "הרחב תפריט" : "צמצם תפריט"}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="hidden md:flex flex-col">
              <h2 className="text-sm font-black text-navy tracking-tight">מערכת ניהול לקוחות</h2>
              <p className="text-[10px] font-bold text-grey uppercase tracking-widest">נחמיה דרוק - פתרונות פיננסיים</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search trigger */}
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              className="h-10 px-3 rounded-xl flex items-center gap-2 bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-slate-200/50 dark:border-slate-700/50 text-grey hover:text-navy dark:hover:text-white transition-all"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs font-medium hidden sm:inline">חיפוש...</span>
              <kbd className="hidden sm:flex px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 text-[10px] font-bold">⌘K</kbd>
            </button>

            <NotificationCenter />
            <ThemeToggle />

            <div className="hidden sm:flex h-10 px-4 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 items-center gap-2 transition-colors">
              <div className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">מחובר</span>
            </div>
          </div>
        </header>

        <GlobalSearch />

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-20 md:pb-6">
          {children}
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </main>
    </div>
  )
}

// ── Mobile Bottom Navigation ──
import Link from 'next/link'
import { LayoutDashboard, Target, Calendar, BarChart3, Settings } from 'lucide-react'

function MobileBottomNav() {
  const pathname = usePathname()

  const items = [
    { href: '/', icon: LayoutDashboard, label: 'בקרה' },
    { href: '/admin/manage', icon: Settings, label: 'ניהול' },
    { href: '/calendar', icon: Calendar, label: 'לוח' },
    { href: '/goals', icon: Target, label: 'יעדים' },
    { href: '/statistics', icon: BarChart3, label: 'דוחות' },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/30 bottom-nav transition-colors duration-300">
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200",
                isActive
                  ? "text-primary"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "animate-pulse-glow")} />
              <span className="text-[10px] font-bold">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
