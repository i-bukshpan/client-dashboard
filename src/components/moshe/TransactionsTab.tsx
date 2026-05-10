'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, TrendingUp, TrendingDown, Pencil, X, Tag, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { createTransaction, deleteTransaction, updateTransaction } from '@/app/moshe/actions'
import { toast } from 'sonner'
import type { MosheTransaction, MoshePartner } from '@/types/moshe'

function fmt(n: number) {
  return '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

interface Props {
  projectId: string
  transactions: MosheTransaction[]
  partners?: MoshePartner[]
  categories?: string[]
}

const TYPE_LABEL: Record<string, string> = { income: 'הכנסה', expense: 'הוצאה' }

function CategoryInput({
  value,
  onChange,
  existingCategories,
  placeholder = 'לדוגמה: שכ"ט'
}: {
  value: string
  onChange: (v: string) => void
  existingCategories: string[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const filtered = existingCategories.filter(c =>
    c.toLowerCase().includes(value.toLowerCase()) && c !== value
  )

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Tag className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
        <Input
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-9 text-sm border-slate-200 bg-white ps-8"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.slice(0, 8).map(cat => (
            <button
              key={cat}
              type="button"
              onMouseDown={() => { onChange(cat); setOpen(false) }}
              className="w-full text-right px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TransactionsTab({ projectId, transactions, partners = [], categories = [] }: Props) {
  const [pending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    notes: '',
    partner_id: '',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    date: '',
    category: '',
    notes: '',
    partner_id: '',
  })

  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterPartner, setFilterPartner] = useState<string>('all')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')

  const partnerMap: Record<string, string> = {}
  partners.forEach(p => { partnerMap[p.id] = p.name })

  // Collect all used categories from transactions ONLY
  const allCategories = Array.from(new Set(
    transactions.map(t => t.category).filter(Boolean) as string[]
  )).sort()

  const filteredTransactions = transactions.filter(t => {
    if (filterCategory !== 'all') {
      const c = t.category || 'none'
      if (filterCategory === 'none' ? c !== 'none' : c !== filterCategory) return false
    }
    if (filterPartner !== 'all') {
      const pId = (t as any).partner_id || 'none'
      if (filterPartner !== pId) return false
    }
    if (filterStartDate && t.date < filterStartDate) return false
    if (filterEndDate && t.date > filterEndDate) return false
    return true
  })

  const totalIncome  = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount) return toast.error('סכום נדרש')
    const r = await createTransaction({ project_id: projectId, ...form })
    if (r.error) { toast.error(r.error); return }
    toast.success('עסקה נוספה')
    setForm(f => ({ ...f, amount: '', category: '', notes: '', partner_id: '' }))
    setShowForm(false)
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await deleteTransaction(id, projectId)
      if (r.error) toast.error(r.error)
      else toast.success('עסקה נמחקה')
    })
  }

  function startEdit(t: MosheTransaction & { partner_id?: string | null }) {
    setEditingId(t.id)
    setEditRow({
      type: t.type as 'income' | 'expense',
      amount: String(t.amount),
      date: t.date,
      category: t.category ?? '',
      notes: t.notes ?? '',
      partner_id: (t as any).partner_id ?? '',
    })
  }

  function saveEdit(id: string) {
    startTransition(async () => {
      const r = await updateTransaction(id, editRow)
      if (r.error) { toast.error(r.error); return }
      toast.success('עסקה עודכנה')
      setEditingId(null)
    })
  }

  const sorted = [...filteredTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-emerald-500 font-bold uppercase">הכנסות</p>
          <p className="text-lg font-black text-emerald-700 mt-0.5">{fmt(totalIncome)}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-red-500 font-bold uppercase">הוצאות</p>
          <p className="text-lg font-black text-red-600 mt-0.5">{fmt(totalExpense)}</p>
        </div>
        <div className={cn('rounded-xl border p-3 text-center', (totalIncome - totalExpense) >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100')}>
          <p className={cn('text-[10px] font-bold uppercase', (totalIncome - totalExpense) >= 0 ? 'text-blue-500' : 'text-orange-500')}>מאזן</p>
          <p className={cn('text-lg font-black mt-0.5', (totalIncome - totalExpense) >= 0 ? 'text-blue-700' : 'text-orange-600')}>
            {fmt(totalIncome - totalExpense)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">עסקאות כלליות</p>
          <Button size="sm" variant="ghost" onClick={() => setShowForm(v => !v)}
            className="text-xs gap-1.5 h-8 text-slate-500 hover:text-slate-800">
            <Plus className="w-3.5 h-3.5" /> הוסף עסקה
          </Button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="px-4 py-4 bg-slate-50 border-b border-slate-100 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-500">סוג</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
                  <SelectTrigger className="h-9 text-sm border-slate-200 bg-white">
                    <SelectValue>{TYPE_LABEL[form.type]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">הכנסה</SelectItem>
                    <SelectItem value="expense">הוצאה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-500">סכום (₪)</Label>
                <Input type="number" dir="ltr" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0" className="h-9 text-sm border-slate-200 bg-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-500">תאריך</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="h-9 text-sm border-slate-200 bg-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-500">קטגוריה</Label>
                <CategoryInput
                  value={form.category}
                  onChange={v => setForm(f => ({ ...f, category: v }))}
                  existingCategories={allCategories}
                />
              </div>
            </div>
            {partners.length > 0 && (
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-500">שותף אחראי</Label>
                <Select value={form.partner_id || '__none__'} onValueChange={v => setForm(f => ({ ...f, partner_id: v === '__none__' ? '' : (v as string) }))}>
                  <SelectTrigger className="h-9 text-sm border-slate-200 bg-white">
                    <SelectValue>
                      {form.partner_id ? (partnerMap[form.partner_id] ?? 'בחר שותף') : 'ללא שיוך'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא שיוך</SelectItem>
                    {partners.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-500">הערות</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="min-h-[60px] text-sm border-slate-200 bg-white resize-none" />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)} className="flex-1 text-xs">ביטול</Button>
              <Button type="submit" size="sm" className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 text-white">שמור עסקה</Button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[120px]">
            <Select value={filterCategory} onValueChange={v => setFilterCategory(v as string)}>
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue placeholder="כל הקטגוריות">
                  {filterCategory === 'all' ? 'כל הקטגוריות' : filterCategory === 'none' ? 'ללא קטגוריה' : filterCategory}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקטגוריות</SelectItem>
                <SelectItem value="none">ללא קטגוריה</SelectItem>
                {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {partners.length > 0 && (
            <div className="flex-1 min-w-[120px]">
              <Select value={filterPartner} onValueChange={v => setFilterPartner(v as string)}>
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue placeholder="כל השותפים">
                    {filterPartner === 'all' ? 'כל השותפים' : filterPartner === 'none' ? 'ללא שיוך' : partnerMap[filterPartner] ?? 'לא ידוע'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל השותפים</SelectItem>
                  <SelectItem value="none">ללא שיוך</SelectItem>
                  {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2">
            <Input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="h-8 text-xs bg-white w-[110px]" title="מתאריך" />
            <Input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="h-8 text-xs bg-white w-[110px]" title="עד תאריך" />
          </div>
        </div>

        <div className="divide-y divide-slate-50">
          {sorted.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-10">אין עסקאות כלליות</p>
          )}
          {sorted.map(t => {
            const tWithPartner = t as MosheTransaction & { partner_id?: string | null }
            const partnerName = tWithPartner.partner_id ? partnerMap[tWithPartner.partner_id] : null

            if (editingId === t.id) {
              return (
                <div key={t.id} className="px-4 py-3 bg-slate-50 border-b border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={editRow.type} onValueChange={v => setEditRow(r => ({ ...r, type: v as any }))}>
                      <SelectTrigger className="h-9 text-sm border-slate-200 bg-white">
                        <SelectValue>{TYPE_LABEL[editRow.type]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">הכנסה</SelectItem>
                        <SelectItem value="expense">הוצאה</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" dir="ltr" value={editRow.amount}
                      onChange={e => setEditRow(r => ({ ...r, amount: e.target.value }))}
                      placeholder="סכום" className="h-9 text-sm border-slate-200 bg-white" />
                    <Input type="date" value={editRow.date}
                      onChange={e => setEditRow(r => ({ ...r, date: e.target.value }))}
                      className="h-9 text-sm border-slate-200 bg-white" />
                    <CategoryInput
                      value={editRow.category}
                      onChange={v => setEditRow(r => ({ ...r, category: v }))}
                      existingCategories={allCategories}
                    />
                  </div>
                  {partners.length > 0 && (
                    <Select value={editRow.partner_id || '__none__'} onValueChange={v => setEditRow(r => ({ ...r, partner_id: v === '__none__' ? '' : (v as string) }))}>
                      <SelectTrigger className="h-9 text-sm border-slate-200 bg-white">
                        <SelectValue>
                          {editRow.partner_id ? (partnerMap[editRow.partner_id] ?? 'בחר שותף') : 'ללא שיוך'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">ללא שיוך</SelectItem>
                        {partners.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Input value={editRow.notes}
                    onChange={e => setEditRow(r => ({ ...r, notes: e.target.value }))}
                    placeholder="הערות" className="h-9 text-sm border-slate-200 bg-white" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(t.id)} disabled={pending}
                      className="flex-1 h-8 bg-slate-800 hover:bg-slate-700 text-white text-xs">שמור</Button>
                    <button onClick={() => setEditingId(null)}
                      className="px-3 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 text-xs">ביטול</button>
                  </div>
                </div>
              )
            }

            return (
              <div key={t.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/50 group">
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  t.type === 'income' ? 'bg-emerald-100' : 'bg-red-100'
                )}>
                  {t.type === 'income'
                    ? <TrendingUp className="w-4 h-4 text-emerald-600" />
                    : <TrendingDown className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{t.notes || t.category || '—'}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[10px] text-slate-400">
                      {format(new Date(t.date), 'dd/MM/yyyy')}
                      {t.category && t.notes && ` · ${t.category}`}
                    </p>
                    {partnerName && (
                      <span className="text-[10px] text-indigo-500 flex items-center gap-0.5">
                        <User className="w-2.5 h-2.5" />{partnerName}
                      </span>
                    )}
                  </div>
                </div>
                <p className={cn('font-black text-sm shrink-0', t.type === 'income' ? 'text-emerald-700' : 'text-red-600')}>
                  {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                </p>
                <button onClick={() => startEdit(t)} disabled={pending}
                  className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-amber-500 hover:bg-amber-50 hover:border-amber-200 flex items-center justify-center shrink-0 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(t.id)} disabled={pending}
                  className="w-7 h-7 rounded-lg text-slate-200 hover:text-red-400 hover:bg-red-50 flex items-center justify-center shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
