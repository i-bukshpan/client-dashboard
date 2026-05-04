'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, TrendingDown, CheckCircle2, X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

function fmt(n: number) {
  return '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

interface Project { id: string; name: string }
interface Transaction {
  id: string; project_id: string; type: string
  amount: number; date: string; category: string | null; notes: string | null
}
interface ProjectPayment {
  id: string; project_id: string; amount: number
  due_date: string | null; notes: string | null; is_paid: boolean; paid_at: string | null
}
interface BuyerPayment {
  id: string; buyer_id: string; project_id: string; amount: number
  due_date: string | null; notes: string | null; is_received: boolean; received_at: string | null
}

interface Props {
  transactions: Transaction[]
  projects: Project[]
  projectPayments?: ProjectPayment[]
  buyerPayments?: BuyerPayment[]
  buyerMap?: Record<string, string>
}

type MovementType = 'tx_income' | 'tx_expense' | 'proj_payment' | 'buyer_payment'

interface Movement {
  id: string
  project_id: string
  type: 'income' | 'expense'
  movementType: MovementType
  amount: number
  date: string
  label: string
  sub: string | null
  completed: boolean
}

export function FinanceFilters({ transactions, projects, projectPayments = [], buyerPayments = [], buyerMap = {} }: Props) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [projectId, setProjectId] = useState('all')
  const [type, setType] = useState('all')
  const [completedFilter, setCompletedFilter] = useState('all')

  const movements = useMemo<Movement[]>(() => {
    const result: Movement[] = []

    // Manual transactions
    for (const t of transactions) {
      result.push({
        id: `tx-${t.id}`,
        project_id: t.project_id,
        type: t.type as 'income' | 'expense',
        movementType: t.type === 'income' ? 'tx_income' : 'tx_expense',
        amount: Number(t.amount),
        date: t.date,
        label: t.notes || t.category || 'עסקה כללית',
        sub: t.category && t.notes ? t.category : null,
        completed: true,
      })
    }

    // Project payments (expenses)
    for (const p of projectPayments) {
      const dateStr = p.paid_at ? p.paid_at.slice(0, 10) : (p.due_date ?? '')
      result.push({
        id: `pp-${p.id}`,
        project_id: p.project_id,
        type: 'expense',
        movementType: 'proj_payment',
        amount: Number(p.amount),
        date: dateStr,
        label: p.notes || 'תשלום פרויקט',
        sub: p.is_paid ? `שולם ${p.paid_at ? format(new Date(p.paid_at), 'dd/MM/yy') : ''}` : (p.due_date ? `מועד: ${format(new Date(p.due_date), 'dd/MM/yy')}` : 'מועד לא נקבע'),
        completed: p.is_paid,
      })
    }

    // Buyer payments (income)
    for (const p of buyerPayments) {
      const dateStr = p.received_at ? p.received_at.slice(0, 10) : (p.due_date ?? '')
      result.push({
        id: `bp-${p.id}`,
        project_id: p.project_id,
        type: 'income',
        movementType: 'buyer_payment',
        amount: Number(p.amount),
        date: dateStr,
        label: buyerMap[p.buyer_id] ? `${buyerMap[p.buyer_id]} — תשלום` : 'תשלום קונה',
        sub: p.is_received ? `התקבל ${p.received_at ? format(new Date(p.received_at), 'dd/MM/yy') : ''}` : (p.due_date ? `מועד: ${format(new Date(p.due_date), 'dd/MM/yy')}` : 'מועד לא נקבע'),
        completed: p.is_received,
      })
    }

    return result
  }, [transactions, projectPayments, buyerPayments, buyerMap])

  const filtered = useMemo(() => {
    return movements.filter(m => {
      if (dateFrom && m.date < dateFrom) return false
      if (dateTo && m.date > dateTo) return false
      if (projectId !== 'all' && m.project_id !== projectId) return false
      if (type !== 'all') {
        if (type === 'income' && m.type !== 'income') return false
        if (type === 'expense' && m.type !== 'expense') return false
        if (type === 'proj_payment' && m.movementType !== 'proj_payment') return false
        if (type === 'buyer_payment' && m.movementType !== 'buyer_payment') return false
        if (type === 'tx' && m.movementType !== 'tx_income' && m.movementType !== 'tx_expense') return false
      }
      if (completedFilter === 'completed' && !m.completed) return false
      if (completedFilter === 'pending' && m.completed) return false
      return true
    }).sort((a, b) => b.date.localeCompare(a.date) || (b.completed ? -1 : 1))
  }, [movements, dateFrom, dateTo, projectId, type, completedFilter])

  const totalIncome  = filtered.filter(m => m.type === 'income' && m.completed).reduce((s, m) => s + m.amount, 0)
  const totalExpense = filtered.filter(m => m.type === 'expense' && m.completed).reduce((s, m) => s + m.amount, 0)
  const totalPending = filtered.filter(m => !m.completed).reduce((s, m) => s + m.amount, 0)

  const hasFilter = dateFrom || dateTo || projectId !== 'all' || type !== 'all' || completedFilter !== 'all'

  function clearFilters() {
    setDateFrom(''); setDateTo(''); setProjectId('all'); setType('all'); setCompletedFilter('all')
  }

  const typeIcon: Record<MovementType, React.ReactNode> = {
    tx_income:    <TrendingUp className="w-4 h-4 text-emerald-600" />,
    tx_expense:   <TrendingDown className="w-4 h-4 text-red-500" />,
    proj_payment: <ArrowDownCircle className="w-4 h-4 text-red-400" />,
    buyer_payment:<ArrowUpCircle className="w-4 h-4 text-emerald-500" />,
  }
  const typeBg: Record<MovementType, string> = {
    tx_income:    'bg-emerald-100',
    tx_expense:   'bg-red-100',
    proj_payment: 'bg-red-50',
    buyer_payment:'bg-emerald-50',
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="font-bold text-slate-800">כל התנועות הכספיות</p>
          <p className="text-[11px] text-slate-400 mt-0.5">תשלומי פרויקט · תשלומי קונים · עסקאות כלליות</p>
        </div>
        {hasFilter && (
          <button onClick={clearFilters}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 font-medium">
            <X className="w-3 h-3" /> נקה סינון
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
              <SelectValue>{projectId === 'all' ? 'כל הפרויקטים' : (projects.find(p => p.id === projectId)?.name ?? projectId)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הפרויקטים</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-bold mb-1">סוג תנועה</p>
          <Select value={type} onValueChange={v => setType(v ?? 'all')}>
            <SelectTrigger className="h-8 text-xs border-slate-200 bg-white">
              <SelectValue>
                {type === 'all' ? 'הכל' : type === 'income' ? 'כל ההכנסות' : type === 'expense' ? 'כל ההוצאות' : type === 'proj_payment' ? 'תשלומי פרויקט' : type === 'buyer_payment' ? 'תשלומי קונים' : 'עסקאות ידניות'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              <SelectItem value="income">כל ההכנסות</SelectItem>
              <SelectItem value="expense">כל ההוצאות</SelectItem>
              <SelectItem value="buyer_payment">תשלומי קונים</SelectItem>
              <SelectItem value="proj_payment">תשלומי פרויקט</SelectItem>
              <SelectItem value="tx">עסקאות ידניות</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-bold mb-1">סטטוס</p>
          <Select value={completedFilter} onValueChange={v => setCompletedFilter(v ?? 'all')}>
            <SelectTrigger className="h-8 text-xs border-slate-200 bg-white">
              <SelectValue>
                {completedFilter === 'all' ? 'הכל' : completedFilter === 'completed' ? 'בוצע' : 'ממתין'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              <SelectItem value="completed">בוצע</SelectItem>
              <SelectItem value="pending">ממתין</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary bar */}
      <div className="px-5 py-2.5 bg-slate-50/30 border-b border-slate-100 flex flex-wrap items-center gap-4 text-xs">
        <span className="text-slate-400">{filtered.length} תנועות</span>
        <span className="text-emerald-700 font-bold">גבייה: {fmt(totalIncome)}</span>
        <span className="text-red-600 font-bold">הוצאות: {fmt(totalExpense)}</span>
        <span className={cn('font-black', (totalIncome - totalExpense) >= 0 ? 'text-blue-700' : 'text-orange-600')}>
          מאזן: {fmt(totalIncome - totalExpense)}
        </span>
        {totalPending > 0 && (
          <span className="text-amber-600 font-bold mr-auto">ממתין: {fmt(totalPending)}</span>
        )}
      </div>

      {/* List */}
      <div className="divide-y divide-slate-50">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-12">אין תנועות בסינון זה</p>
        )}
        {filtered.map(m => {
          const projectName = projects.find(p => p.id === m.project_id)?.name
          return (
            <div key={m.id} className={cn(
              'flex items-center gap-4 px-5 py-3 hover:bg-slate-50/50 transition-colors',
              !m.completed && 'opacity-60'
            )}>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', typeBg[m.movementType])}>
                {typeIcon[m.movementType]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={cn('text-sm truncate', m.completed ? 'text-slate-700' : 'text-slate-500')}>{m.label}</p>
                  {m.completed && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                </div>
                <p className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                  {m.date && <span>{m.date.slice(0, 10).split('-').reverse().join('/')}</span>}
                  {m.sub && <span>· {m.sub}</span>}
                  {projectName && <span>· {projectName}</span>}
                </p>
              </div>
              <p className={cn('font-black text-sm shrink-0',
                m.type === 'income' ? (m.completed ? 'text-emerald-700' : 'text-emerald-400') : (m.completed ? 'text-red-600' : 'text-red-400'))}>
                {m.type === 'income' ? '+' : '-'}{fmt(m.amount)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
