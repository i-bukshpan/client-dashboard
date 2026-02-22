'use client'

import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Trash2, Clock, Bell, Phone, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ClientTag } from '@/lib/actions/tags'
import { SparklineChart } from './sparkline-chart'

interface ClientCardProps {
  id: string
  name: string
  currentBalance: number
  monthlyIncome: number
  monthlyExpense: number
  tags?: ClientTag[]
  status?: string | null
  selected?: boolean
  onSelect?: (id: string, selected: boolean) => void
  onDelete?: (id: string, name: string) => void
  bulkMode?: boolean
  pendingPaymentsCount?: number
  openRemindersCount?: number
  unreadMessagesCount?: number
  phone?: string | null
  email?: string | null
  childCount?: number
  monthlyTrends?: {
    income: Array<{ month: string; value: number }>
    expense: Array<{ month: string; value: number }>
  }
  readOnly?: boolean
  isPublicView?: boolean
  onCardClick?: (id: string, name: string) => void
}

export function ClientCard({
  id,
  name,
  currentBalance,
  monthlyIncome,
  monthlyExpense,
  tags = [],
  status,
  selected = false,
  onSelect,
  onDelete,
  bulkMode = false,
  pendingPaymentsCount = 0,
  openRemindersCount = 0,
  unreadMessagesCount = 0,
  phone,
  email,
  childCount = 0,
  monthlyTrends,
  readOnly = false,
  isPublicView = false,
  onCardClick,
}: ClientCardProps) {
  const netChange = monthlyIncome - monthlyExpense
  const isPositive = netChange >= 0

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete?.(id, name)
  }

  const handleSelect = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect?.(id, !selected)
  }

  const cardContent = (
    <div className={`rounded-2xl border ${selected ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' : 'border-border/50 bg-white/70 backdrop-blur-md'} p-5 sm:p-6 shadow-sm transition-all duration-300 glass-card hover-lift relative group overflow-hidden`}>
      {/* Decorative gradient corner */}
      <div className={`absolute top-0 left-0 w-24 h-24 -ml-12 -mt-12 rounded-full transition-transform duration-500 group-hover:scale-150 ${status === 'פעיל' ? 'bg-emerald/5' : status === 'ליד' ? 'bg-primary/5' : 'bg-grey/5'}`} />

      {bulkMode && (
        <div className="absolute top-3 right-3 z-20">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect?.(id, e.target.checked)}
            className="h-5 w-5 cursor-pointer rounded-md border-border text-primary focus:ring-primary transition-all"
          />
        </div>
      )}
      {onDelete && !bulkMode && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-all duration-300 text-rose-500 hover:text-white hover:bg-rose-500 z-10 h-8 w-8 rounded-full"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <h3 className="text-lg font-bold text-navy tracking-tight">{name}</h3>
            {status && (
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${status === 'פעיל' ? 'bg-emerald/10 text-emerald border border-emerald/20' :
                status === 'ליד' ? 'bg-primary/10 text-primary border border-primary/20' :
                  'bg-grey/10 text-grey border border-grey/20'
                }`}>
                {status}
              </span>
            )}
            {childCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100" title={`${childCount} לקוחות משנה`}>
                👥 {childCount}
              </span>
            )}

            <div className="flex gap-1.5 ml-auto">
              {pendingPaymentsCount > 0 && (
                <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100 shadow-sm" title={`${pendingPaymentsCount} תשלומים ממתינים`}>
                  <Clock className="h-4 w-4" />
                </div>
              )}
              {openRemindersCount > 0 && (
                <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-purple-50 text-purple-600 border border-purple-100 shadow-sm" title={`${openRemindersCount} תזכורות פתוחות`}>
                  <Bell className="h-4 w-4" />
                </div>
              )}
              {unreadMessagesCount > 0 && (
                <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-100 shadow-sm animate-pulse" title={`${unreadMessagesCount} הודעות חדשות`}>
                  <MessageSquare className="h-4 w-4" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {phone && (
              <div className="flex items-center gap-2 px-2 py-1.5 bg-grey/5 rounded-xl border border-border/10 text-xs text-grey hover:bg-white transition-colors duration-200">
                <div className="p-1 bg-white rounded-md shadow-xs"><Phone className="h-3 w-3" /></div>
                <span dir="ltr" className="font-medium">{phone}</span>
              </div>
            )}
            {id && !readOnly && !isPublicView && (
              <div className="flex items-center gap-2 px-2 py-1.5 bg-grey/5 rounded-xl border border-border/10 text-xs text-grey">
                <div className="p-1 bg-white rounded-md shadow-xs"><ArrowLeft className="h-3 w-3" /></div>
                <span className="truncate font-medium">פרטים</span>
              </div>
            )}
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {tags.map(tag => (
                <span
                  key={tag.id}
                  className="px-2.5 py-0.5 rounded-md text-[10px] font-bold text-white shadow-sm ring-1 ring-white/20"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          <div className="space-y-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-grey">יתרה נוכחית:</span>
              <span className={`text-xl font-black ${currentBalance >= 0 ? 'text-navy' : 'text-rose-600'}`}>
                ₪{currentBalance.toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-2.5 bg-emerald/5 rounded-xl border border-emerald/10">
                <span className="text-[10px] font-bold text-emerald/70 block mb-0.5">הכנסה חודשית</span>
                <span className="text-sm font-black text-emerald">
                  ₪{monthlyIncome.toLocaleString()}
                </span>
              </div>
              <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                <span className="text-[10px] font-bold text-rose-500/70 block mb-0.5">הוצאה חודשית</span>
                <span className="text-sm font-black text-rose-600">
                  ₪{monthlyExpense.toLocaleString()}
                </span>
              </div>
            </div>

            {monthlyTrends && (monthlyTrends.income.some(m => m.value > 0) || monthlyTrends.expense.some(m => m.value > 0)) ? (
              <div className="space-y-2 pt-2">
                {monthlyTrends.income.some(m => m.value > 0) && (
                  <div>
                    <span className="text-[10px] font-bold text-grey/60 uppercase tracking-tighter mb-1 block">מגמת הכנסות</span>
                    <SparklineChart data={monthlyTrends.income} color="#10b981" />
                  </div>
                )}
                {monthlyTrends.expense.some(m => m.value > 0) && (
                  <div>
                    <span className="text-[10px] font-bold text-grey/60 uppercase tracking-tighter mb-1 block">מגמת הוצאות</span>
                    <SparklineChart data={monthlyTrends.expense} color="#ef4444" />
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-2 border-t border-dashed border-border/50">
              <span className="text-[10px] font-bold text-grey">שינוי נטו החודש:</span>
              <div className="flex items-center gap-1.5">
                <div className={`p-1 rounded-full ${isPositive ? 'bg-emerald/10 text-emerald' : 'bg-rose-100 text-rose-600'}`}>
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                </div>
                <span className={`text-base font-black ${isPositive ? 'text-emerald' : 'text-rose-600'}`}>
                  ₪{Math.abs(netChange).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (bulkMode) {
    return (
      <div onClick={handleSelect} className="cursor-pointer">
        {cardContent}
      </div>
    )
  }

  if (onCardClick) {
    return (
      <div onClick={(e) => { e.preventDefault(); onCardClick(id, name); }} className="cursor-pointer">
        {cardContent}
      </div>
    )
  }

  if (readOnly && !isPublicView) {
    return (
      <div>
        {cardContent}
      </div>
    )
  }

  return (
    <Link href={`/clients/${id}`}>
      {cardContent}
    </Link>
  )
}

