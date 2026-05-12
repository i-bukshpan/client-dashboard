'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import Link from 'next/link'

function fmt(n: number) {
  return '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

interface OverdueItem {
  id: string
  kind: 'expense' | 'income'
  label: string
  projectName: string
  amount: number
  due_date: string
  notes?: string | null
}

interface Props {
  items: OverdueItem[]
}

export function OverdueAlert({ items }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) return null

  const expenses = items.filter(i => i.kind === 'expense')
  const income   = items.filter(i => i.kind === 'income')

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3.5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-red-800 text-sm">
            {items.length} תשלומים באיחור
          </p>
          <p className="text-xs text-red-600 mt-0.5">
            {expenses.length > 0 && `${expenses.length} הוצאות שצריך לשלם`}
            {expenses.length > 0 && income.length > 0 && ' · '}
            {income.length > 0 && `${income.length} תשלומים לגבייה`}
          </p>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-bold shrink-0"
        >
          {expanded ? 'הסתר' : 'פירוט'}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <Link href="/moshe/calendar" className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 shrink-0">
          יומן <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
        </Link>
      </div>

      {expanded && (
        <div className="border-t border-red-100 divide-y divide-red-50/80 max-h-72 overflow-y-auto">
          {items
            .sort((a, b) => a.due_date.localeCompare(b.due_date))
            .map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                  item.kind === 'expense' ? 'bg-red-200 text-red-700' : 'bg-emerald-100 text-emerald-700'
                )}>
                  {item.kind === 'expense' ? 'הוצאה' : 'הכנסה'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{item.label}</p>
                  <p className="text-[10px] text-slate-400 truncate">{item.projectName}</p>
                  {item.notes && <p className="text-[10px] text-slate-400 truncate">{item.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-xs font-black', item.kind === 'expense' ? 'text-red-600' : 'text-emerald-700')}>
                    {fmt(item.amount)}
                  </p>
                  <p className="text-[10px] text-red-400">
                    {format(new Date(item.due_date + 'T00:00:00'), 'dd/MM/yy', { locale: he })}
                  </p>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
