'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, X, Search, LayoutDashboard, Calendar, Users, CheckSquare, Wallet } from 'lucide-react'
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
  const isLoginPage = pathname === '/login'

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const applyMatch = () => setIsSidebarOpen(mediaQuery.matches)
    applyMatch()
    mediaQuery.addEventListener('change', applyMatch)
    return () => mediaQuery.removeEventListener('change', applyMatch)
  }, [])

  if (isPublicView || isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground transition-colors duration-300">
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
        {/* Clean Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between px-6 md:px-8 bg-card border-b border-border transition-colors duration-300">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="md:hidden h-10 w-10 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all active:scale-95 flex items-center justify-center border border-border"
              aria-label={isSidebarOpen ? "סגור תפריט" : "פתח תפריט"}
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="hidden md:flex h-10 w-10 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all active:scale-95 items-center justify-center border border-border"
              aria-label={isSidebarCollapsed ? "הרחב תפריט" : "צמצם תפריט"}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="hidden md:flex flex-col">
              <h2 className="text-sm font-bold text-foreground tracking-tight">מערכת ניהול לקוחות</h2>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">נחמיה דרוק - פתרונות פיננסיים</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search trigger */}
              <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              className="h-10 px-3 rounded-lg flex items-center gap-2 bg-secondary/50 hover:bg-secondary border border-border text-muted-foreground hover:text-foreground transition-all"
            >
              <Search className="h-4 w-4" />
              <span className="text-xs font-medium hidden sm:inline">חיפוש...</span>
              <kbd className="hidden sm:flex px-1.5 py-0.5 rounded-md bg-background border border-border text-[10px] font-bold">⌘K</kbd>
            </button>

            <NotificationCenter />
            <ThemeToggle />

            <div className="hidden sm:flex h-10 px-4 rounded-lg bg-secondary border border-border items-center gap-2 transition-colors">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-secondary-foreground">מחובר</span>
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

function MobileBottomNav() {
  const pathname = usePathname()

  const items = [
    { href: '/', icon: LayoutDashboard, label: 'היום שלי' },
    { href: '/clients', icon: Users, label: 'לקוחות' },
    { href: '/tasks', icon: CheckSquare, label: 'משימות' },
    { href: '/calendar', icon: Calendar, label: 'יומן' },
    { href: '/cashflow', icon: Wallet, label: 'כספים' },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border bottom-nav transition-colors duration-300">
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
