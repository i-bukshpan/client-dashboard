'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FolderKanban, Calendar, BarChart3, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/moshe', label: 'דשבורד', icon: LayoutDashboard, exact: true },
  { href: '/moshe/projects', label: 'פרויקטים', icon: FolderKanban },
  { href: '/moshe/calendar', label: 'יומן תשלומים', icon: Calendar },
  { href: '/moshe/finance', label: 'מאזן כספי', icon: BarChart3 },
]

export function MosheSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-[#0f172a] text-white">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-white/10 gap-3 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shrink-0">
          <span className="text-white font-black text-xs">מפ</span>
        </div>
        <div>
          <p className="text-[11px] font-bold text-white leading-none">משה פרוש</p>
          <p className="text-[9px] text-white/40 mt-0.5">ניהול פרויקטים</p>
        </div>
      </div>

      {/* New project shortcut */}
      <div className="p-3">
        <Link
          href="/moshe/projects/new"
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

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <p className="text-[10px] text-white/25 text-center">Nehemiah OS · פרטי</p>
      </div>
    </aside>
  )
}
