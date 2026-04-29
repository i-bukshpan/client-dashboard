'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, TrendingDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

function fmt(n: number) {
  return '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

interface Project { id: string; name: string }
interface Transaction {
  id: string
  project_id: string
  type: string
  amount: number
  date: string
  category: string | null
  notes: string | null
}

interface Props {
  transactions: Transaction[]
  projects: Project[]
}

export function FinanceFilters({ transactions, projects }: Props) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [projectId, setProjectId] = useState('all')
  const [type, setType] = useState('all')

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (dateFrom && t.date < dateFrom) return false
      if (dateTo && t.date > dateTo) return false
      if (projectId !== 'all' && t.project_id !== projectId) return false
      if (type !== 'all' && t.type !== type) return false
      return true
    }).sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, dateFrom, dateTo, projectId, type])

  const totalIncome  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  const hasFilter = dateFrom || dateTo || projectId !== 'all' || type !== 'all'

  function clearFilters() {
    setDateFrom('')
    setDateTo('')
    setProjectId('all')
    setType('all')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <p className="font-bold text-slate-800">עסקאות כלליות</p>
        {hasFilter && (
          <button onClick={clearFilters}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 font-medium">
            <X className="w-3 h-3" /> נקה סינון
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] text-slate-400 font-bold mb-1">מתאריך</p>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-8 text-xs border-slate-200 bg-white" />
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-bold mb-1">עד תאריך</p>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-8 text-xs border-slate-200 bg-white" />
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-bold mb-1">פרויקט</p>
          <Select value={projectId} onValueChange={v => setProjectId(v ?? 'all')}>
            <SelectTrigger className="h-8 text-xs border-slate-200 bg-white">
              <SelectValue>
                {projectId === 'all' ? 'כל הפרויקטים' : (projects.find(p => p.id === projectId)?.name ?? projectId)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" key="all-projects">כל הפרויקטים</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-bold mb-1">סוג</p>
          <Select value={type} onValueChange={v => setType(v ?? 'all')}>
            <SelectTrigger className="h-8 text-xs border-slate-200 bg-white">
              <SelectValue>
                {type === 'all' ? 'הכל' : type === 'income' ? 'הכנסות' : 'הוצאות'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              <SelectItem value="income">הכנסות</SelectItem>
              <SelectItem value="expense">הוצאות</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary bar */}
      <div className="px-5 py-2.5 bg-slate-50/30 border-b border-slate-100 flex items-center gap-6 text-xs">
        <span className="text-slate-400">{filtered.length} עסקאות</span>
        <span className="text-emerald-700 font-bold">הכנסות: {fmt(totalIncome)}</span>
        <span className="text-red-600 font-bold">הוצאות: {fmt(totalExpense)}</span>
        <span className={cn('font-black', (totalIncome - totalExpense) >= 0 ? 'text-blue-700' : 'text-orange-600')}>
          מאזן: {fmt(totalIncome - totalExpense)}
        </span>
      </div>

      {/* List */}
      <div className="divide-y divide-slate-50">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-12">אין עסקאות בסינון זה</p>
        )}
        {filtered.map(t => {
          const projectName = projects.find(p => p.id === t.project_id)?.name
          return (
            <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/50">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                t.type === 'income' ? 'bg-emerald-100' : 'bg-red-100')}>
                {t.type === 'income'
                  ? <TrendingUp className="w-4 h-4 text-emerald-600" />
                  : <TrendingDown className="w-4 h-4 text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 truncate">{t.notes || t.category || '—'}</p>
                <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <span>{format(new Date(t.date), 'dd/MM/yyyy')}</span>
                  {t.category && t.notes && <span>· {t.category}</span>}
                  {projectName && <span>· {projectName}</span>}
                </p>
              </div>
              <p className={cn('font-black text-sm shrink-0',
                t.type === 'income' ? 'text-emerald-700' : 'text-red-600')}>
                {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
