'use client'

import Link from 'next/link'
import { Plus, DollarSign, CheckSquare, Calendar } from 'lucide-react'

const actions = [
  {
    label: 'הוסף הכנסה',
    icon: DollarSign,
    href: '/admin/finance',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200/60',
  },
  {
    label: 'הוסף משימה',
    icon: CheckSquare,
    href: '/admin/tasks',
    color: 'text-blue-600',
    bg: 'bg-blue-50 hover:bg-blue-100 border-blue-200/60',
  },
  {
    label: 'קבע פגישה',
    icon: Calendar,
    href: '/admin/calendar',
    color: 'text-purple-600',
    bg: 'bg-purple-50 hover:bg-purple-100 border-purple-200/60',
  },
]

export function DashboardQuickActions() {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-150 ${action.bg} ${action.color}`}
        >
          <Plus className="w-4 h-4" />
          <action.icon className="w-4 h-4" />
          {action.label}
        </Link>
      ))}
    </div>
  )
}
