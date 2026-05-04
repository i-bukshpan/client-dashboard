'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, FolderKanban, Calendar, BarChart3, Plus, Settings, LogOut, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/moshe', label: 'דשבורד', icon: LayoutDashboard, exact: true },
  { href: '/moshe/projects', label: 'פרויקטים', icon: FolderKanban },
  { href: '/moshe/calendar', label: 'יומן תשלומים', icon: Calendar },
  { href: '/moshe/finance', label: 'מאזן כספי', icon: BarChart3 },
]

interface Props {
  isAdmin: boolean
  onClose?: () => void
}

export function MosheSidebar({ isAdmin, onClose }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-56 h-full flex flex-col bg-[#0f172a] text-white">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-white/10 gap-3 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shrink-0">
          <span className="text-white font-black text-xs">מפ</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-white leading-none">משה פרוש</p>
          <p className="text-[9px] text-white/40 mt-0.5">ניהול פרויקטים</p>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* New project shortcut */}
      <div className="p-3">
        <Link
          href="/moshe/projects/new"
          onClick={onClose}
          className="flex items-center gap-2 w-full bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold rounded-xl px-3 py-2.5 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          פרויקט חדש
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              isActive(href, exact)
                ? 'bg-white/15 text-white'
                : 'text-white/50 hover:text-white hover:bg-white/8'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer: settings + logout */}
      <div className="p-3 border-t border-white/10 space-y-0.5">
        <Link
          href="/moshe/settings"
          onClick={onClose}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full',
            isActive('/moshe/settings')
              ? 'bg-white/15 text-white'
              : 'text-white/50 hover:text-white hover:bg-white/8'
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          הגדרות
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full text-white/50 hover:text-red-400 hover:bg-red-400/10"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          התנתקות
        </button>
        <p className="text-[10px] text-white/20 text-center pt-2">Nehemiah OS · פרטי</p>
      </div>
    </aside>
  )
}
