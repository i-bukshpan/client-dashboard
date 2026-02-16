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
  monthlyTrends?: {
    income: Array<{ month: string; value: number }>
    expense: Array<{ month: string; value: number }>
  }
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
  monthlyTrends,
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
    <div className={`rounded-lg border ${selected ? 'border-blue-500 bg-blue-50' : 'border-grey/20 bg-white'} p-4 sm:p-6 shadow-sm transition-all hover:shadow-md relative group`}>
      {bulkMode && (
        <div className="absolute top-3 right-3 z-20">
          <input
            type="checkbox"
            checked={selected}
            onClick={handleSelect}
            readOnly
            className="h-5 w-5 cursor-pointer"
          />
        </div>
      )}
      {onDelete && !bulkMode && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50 z-10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-base sm:text-lg font-semibold text-navy">{name}</h3>
            {status && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${status === 'פעיל' ? 'bg-green-100 text-green-700' :
                status === 'ליד' ? 'bg-blue-100 text-blue-700' :
                  'bg-grey/20 text-grey'
                }`}>
                {status}
              </span>
            )}
            {pendingPaymentsCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700" title={`${pendingPaymentsCount} תשלומים ממתינים`}>
                <Clock className="h-3 w-3" />
                {pendingPaymentsCount}
              </span>
            )}
            {openRemindersCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700" title={`${openRemindersCount} תזכורות פתוחות`}>
                <Bell className="h-3 w-3" />
                {openRemindersCount}
              </span>
            )}
            {unreadMessagesCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 animate-pulse" title={`${unreadMessagesCount} הודעות חדשות`}>
                <MessageSquare className="h-3 w-3" />
                {unreadMessagesCount}
              </span>
            )}
          </div>
          {phone && (
            <div className="flex items-center gap-1 mb-1 text-xs text-grey">
              <Phone className="h-3 w-3" />
              <span dir="ltr">{phone}</span>
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map(tag => (
                <span
                  key={tag.id}
                  className="px-2 py-0.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-grey">יתרה נוכחית:</span>
              <span className={`text-lg font-bold ${currentBalance >= 0 ? 'text-navy' : 'text-red-500'}`}>
                ₪{currentBalance.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-grey">הכנסה חודשית:</span>
              <span className="text-sm font-medium text-emerald">
                ₪{monthlyIncome.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-grey">הוצאה חודשית:</span>
              <span className="text-sm font-medium text-red-500">
                ₪{monthlyExpense.toLocaleString()}
              </span>
            </div>
            {monthlyTrends && (monthlyTrends.income.some(m => m.value > 0) || monthlyTrends.expense.some(m => m.value > 0)) ? (
              <div className="space-y-2 pt-2 border-t border-grey/20">
                {monthlyTrends.income.some(m => m.value > 0) && (
                  <div>
                    <span className="text-xs text-grey">מגמת הכנסות (3 חודשים):</span>
                    <SparklineChart data={monthlyTrends.income} color="#10b981" />
                  </div>
                )}
                {monthlyTrends.expense.some(m => m.value > 0) && (
                  <div>
                    <span className="text-xs text-grey">מגמת הוצאות (3 חודשים):</span>
                    <SparklineChart data={monthlyTrends.expense} color="#ef4444" />
                  </div>
                )}
              </div>
            ) : monthlyIncome === 0 && monthlyExpense === 0 ? (
              <div className="pt-2 border-t border-grey/20 text-center py-3">
                <p className="text-xs text-grey">אין מספיק נתונים להצגת מגמה</p>
              </div>
            ) : null}
            <div className="flex items-center justify-between pt-2 border-t border-grey/20">
              <span className="text-sm text-grey">שינוי נטו:</span>
              <div className="flex items-center gap-1">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-emerald" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${isPositive ? 'text-emerald' : 'text-red-500'}`}>
                  ₪{Math.abs(netChange).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
        <ArrowLeft className="h-5 w-5 text-grey ml-4" />
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

  return (
    <Link href={`/clients/${id}`}>
      {cardContent}
    </Link>
  )
}

