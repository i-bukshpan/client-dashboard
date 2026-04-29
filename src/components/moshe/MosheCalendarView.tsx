'use client'

import { useState } from 'react'
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isBefore, isToday } from 'date-fns'
import { he } from 'date-fns/locale'
import { ChevronRight, ChevronLeft, Plus, Check, AlertTriangle, LayoutList, CalendarDays as CalIcon, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { createCalendarEvent, deleteCalendarEvent, toggleProjectPayment, toggleBuyerPayment, updateCalendarEvent } from '@/app/moshe/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

type CalItem =
  | { kind: 'expense'; id: string; date: Date; amount: number; label: string; notes: string; is_paid: boolean; project_id: string }
  | { kind: 'income';  id: string; date: Date; amount: number; label: string; notes: string; projectName: string; is_received: boolean; project_id: string; buyer_id: string }
  | { kind: 'event';   id: string; date: Date; title: string; type: string; notes: string; end_time?: string }

function fmt(n: number) {
  return '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

interface Props {
  projPayments: any[]
  buyerPayments: any[]
  manualEvents: any[]
  projects: any[]
}

export function MosheCalendarView({ projPayments, buyerPayments, manualEvents, projects }: Props) {
  const [month, setMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [editEventId, setEditEventId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'expense' | 'income' | 'event'>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [eventForm, setEventForm] = useState({ title: '', start_time: '', end_time: '', notes: '', type: 'meeting' })
  const [editForm, setEditForm] = useState({ title: '', start_time: '', end_time: '', notes: '', type: 'meeting' })
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const today = new Date()

  const items: CalItem[] = []

  projPayments.forEach(p => {
    if (!p.due_date) return
    items.push({
      kind: 'expense',
      id: p.id,
      date: new Date(p.due_date),
      amount: Number(p.amount),
      label: p.moshe_projects?.name ?? 'פרויקט',
      notes: p.notes ?? '',
      is_paid: p.is_paid,
      project_id: p.project_id,
    })
  })

  buyerPayments.forEach(p => {
    if (!p.due_date) return
    items.push({
      kind: 'income',
      id: p.id,
      date: new Date(p.due_date),
      amount: Number(p.amount),
      label: p.moshe_buyers?.name ?? 'קונה',
      notes: p.notes ?? '',
      projectName: p.moshe_projects?.name ?? '',
      is_received: p.is_received,
      project_id: p.project_id,
      buyer_id: p.buyer_id,
    })
  })

  manualEvents.forEach(e => {
    items.push({
      kind: 'event',
      id: e.id,
      date: new Date(e.start_time),
      title: e.title,
      type: e.type,
      notes: e.notes ?? '',
      end_time: e.end_time,
    })
  })

  const filtered = items
    .filter(i => filter === 'all' || i.kind === filter)
    .filter(i => {
      if (projectFilter === 'all') return true
      if (i.kind === 'event') return false
      return i.project_id === projectFilter
    })

  const monthStart = startOfMonth(month)
  const monthEnd   = endOfMonth(month)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

  const itemsOnDay = (day: Date) => filtered.filter(i => isSameDay(i.date, day))
  const selectedItems = selectedDate ? filtered.filter(i => isSameDay(i.date, selectedDate)) : []

  const noDateExpenses = projPayments.filter(p => !p.due_date && !p.is_paid)
  const noDateIncome   = buyerPayments.filter(p => !p.due_date && !p.is_received)

  const overdueItems = filtered.filter(i =>
    isBefore(i.date, today) &&
    (i.kind === 'expense' ? !i.is_paid : i.kind === 'income' ? !i.is_received : false)
  )

  async function toggleItem(item: CalItem) {
    if (item.kind === 'expense') {
      const r = await toggleProjectPayment(item.id, item.project_id, !item.is_paid)
      if (r.error) toast.error(r.error)
      else router.refresh()
    } else if (item.kind === 'income') {
      const r = await toggleBuyerPayment(item.id, item.project_id, !item.is_received)
      if (r.error) toast.error(r.error)
      else router.refresh()
    }
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const r = await createCalendarEvent(eventForm)
    if (r.error) { toast.error(r.error); setSaving(false); return }
    toast.success('אירוע נוסף')
    setAddEventOpen(false)
    setEventForm({ title: '', start_time: '', end_time: '', notes: '', type: 'meeting' })
    setSaving(false)
    router.refresh()
  }

  function openEditEvent(id: string) {
    const ev = manualEvents.find(e => e.id === id)
    if (!ev) return
    setEditEventId(id)
    setEditForm({
      title: ev.title,
      start_time: ev.start_time ? ev.start_time.slice(0, 16) : '',
      end_time: ev.end_time ? ev.end_time.slice(0, 16) : '',
      notes: ev.notes ?? '',
      type: ev.type,
    })
  }

  async function handleEditEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!editEventId) return
    setSaving(true)
    const r = await updateCalendarEvent(editEventId, editForm)
    if (r.error) { toast.error(r.error); setSaving(false); return }
    toast.success('אירוע עודכן')
    setEditEventId(null)
    setSaving(false)
    router.refresh()
  }

  async function handleDeleteEvent(id: string) {
    const r = await deleteCalendarEvent(id)
    if (r.error) toast.error(r.error)
    else { toast.success('אירוע נמחק'); router.refresh() }
  }

  const typeLabel: Record<string, string> = { meeting: 'פגישה', reminder: 'תזכורת', other: 'אחר' }

  // Sorted list of all items for list view
  const sortedAll = [...filtered].sort((a, b) => a.date.getTime() - b.date.getTime())

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">יומן תשלומים</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
            <button onClick={() => setViewMode('calendar')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                viewMode === 'calendar' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              <CalIcon className="w-3.5 h-3.5" /> יומן
            </button>
            <button onClick={() => setViewMode('list')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              <LayoutList className="w-3.5 h-3.5" /> רשימה
            </button>
          </div>
          <Button onClick={() => setAddEventOpen(true)} size="sm"
            className="bg-amber-500 hover:bg-amber-400 text-white font-bold gap-2 h-9 text-xs">
            <Plus className="w-3.5 h-3.5" /> הוסף פגישה
          </Button>
        </div>
      </div>

      {overdueItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {overdueItems.filter(i => i.kind === 'expense').length} הוצאות
            · {overdueItems.filter(i => i.kind === 'income').length} הכנסות
            — באיחור ולא טופלו
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { v: 'all', label: 'הכל' },
          { v: 'expense', label: 'הוצאות' },
          { v: 'income', label: 'הכנסות' },
          { v: 'event', label: 'פגישות' },
        ].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v as any)}
            className={cn(
              'text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors',
              filter === f.v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            )}>
            {f.label}
          </button>
        ))}
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 cursor-pointer">
          <option value="all">כל הפרויקטים</option>
          {projects.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Calendar grid */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <button onClick={() => setMonth(m => subMonths(m, 1))}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
              <p className="font-bold text-slate-800">
                {format(month, 'MMMM yyyy', { locale: he })}
              </p>
              <button onClick={() => setMonth(m => addMonths(m, 1))}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-100">
              {DAY_NAMES.map(d => (
                <div key={d} className="py-2 text-center text-[11px] font-bold text-slate-400">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                const dayItems = itemsOnDay(day)
                const isCurrentMonth = day.getMonth() === month.getMonth()
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const isTodayDay = isToday(day)
                const hasOverdue = dayItems.some(it =>
                  isBefore(it.date, today) &&
                  (it.kind === 'expense' ? !it.is_paid : it.kind === 'income' ? !it.is_received : false)
                )

                return (
                  <button key={i}
                    onClick={() => setSelectedDate(d => d && isSameDay(d, day) ? null : day)}
                    className={cn(
                      'min-h-[64px] p-1.5 border-b border-r border-slate-50 text-right transition-colors relative',
                      !isCurrentMonth && 'opacity-30',
                      isSelected && 'bg-amber-50',
                      isTodayDay && !isSelected && 'bg-blue-50/50',
                      'hover:bg-slate-50'
                    )}>
                    <span className={cn(
                      'text-xs font-bold inline-flex w-6 h-6 items-center justify-center rounded-full',
                      isTodayDay ? 'bg-amber-500 text-white' : 'text-slate-600',
                    )}>
                      {format(day, 'd')}
                    </span>

                    {hasOverdue && (
                      <span className="absolute top-1 end-1 w-1.5 h-1.5 rounded-full bg-red-400" />
                    )}

                    <div className="mt-0.5 space-y-0.5">
                      {dayItems.slice(0, 2).map((it, j) => (
                        <div key={j} className={cn(
                          'text-[9px] font-bold px-1 py-0.5 rounded truncate',
                          it.kind === 'expense' ? (it.is_paid ? 'bg-slate-100 text-slate-400 line-through' : 'bg-red-100 text-red-700') :
                          it.kind === 'income'  ? (it.is_received ? 'bg-slate-100 text-slate-400 line-through' : 'bg-emerald-100 text-emerald-700') :
                          'bg-blue-100 text-blue-700'
                        )}>
                          {it.kind !== 'event' ? fmt(it.amount) : it.title}
                        </div>
                      ))}
                      {dayItems.length > 2 && (
                        <p className="text-[9px] text-slate-400 text-center">+{dayItems.length - 2}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            {selectedDate && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-800">
                    {format(selectedDate, "EEEE, d בMMMM", { locale: he })}
                  </p>
                  <p className="text-xs text-slate-400">{selectedItems.length} פריטים</p>
                </div>
                <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                  {selectedItems.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-8">אין פריטים ביום זה</p>
                  )}
                  {selectedItems.map(item => (
                    <CalendarDayItem key={item.id} item={item} onToggle={toggleItem} onEditEvent={openEditEvent} onDeleteEvent={handleDeleteEvent} />
                  ))}
                </div>
              </div>
            )}

            {(noDateExpenses.length > 0 || noDateIncome.length > 0) && (
              <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-amber-100 bg-amber-50/50">
                  <p className="text-xs font-bold text-amber-700">תשלומים ללא תאריך ({noDateExpenses.length + noDateIncome.length})</p>
                </div>
                <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
                  {noDateExpenses.map((p: any) => (
                    <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-600 truncate">{p.moshe_projects?.name ?? 'פרויקט'}</p>
                        {p.notes && <p className="text-[10px] text-slate-400 truncate">{p.notes}</p>}
                      </div>
                      <p className="text-xs font-black text-red-600 shrink-0">{fmt(Number(p.amount))}</p>
                    </div>
                  ))}
                  {noDateIncome.map((p: any) => (
                    <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-600 truncate">{p.moshe_buyers?.name ?? 'קונה'}</p>
                        {p.notes && <p className="text-[10px] text-slate-400 truncate">{p.notes}</p>}
                      </div>
                      <p className="text-xs font-black text-emerald-700 shrink-0">{fmt(Number(p.amount))}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* List view */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="font-bold text-slate-800">כל הפריטים</p>
            <span className="text-xs text-slate-400">{sortedAll.length} פריטים</span>
          </div>
          {sortedAll.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-16">אין פריטים</p>
          )}
          <div className="divide-y divide-slate-50">
            {sortedAll.map(item => (
              <CalendarListItem key={item.id} item={item} onToggle={toggleItem} onEditEvent={openEditEvent} onDeleteEvent={handleDeleteEvent} />
            ))}
          </div>
        </div>
      )}

      {/* Add event sheet */}
      <Sheet open={addEventOpen} onOpenChange={setAddEventOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="pb-4 border-b border-slate-100">
            <SheetTitle className="text-lg font-bold">הוספת פגישה / תזכורת</SheetTitle>
          </SheetHeader>
          <EventForm form={eventForm} setForm={setEventForm} onSubmit={handleAddEvent} onCancel={() => setAddEventOpen(false)} saving={saving} submitLabel="הוסף" />
        </SheetContent>
      </Sheet>

      {/* Edit event sheet */}
      <Sheet open={!!editEventId} onOpenChange={open => !open && setEditEventId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="pb-4 border-b border-slate-100">
            <SheetTitle className="text-lg font-bold">עריכת אירוע</SheetTitle>
          </SheetHeader>
          <EventForm form={editForm} setForm={setEditForm} onSubmit={handleEditEvent} onCancel={() => setEditEventId(null)} saving={saving} submitLabel="שמור שינויים" />
        </SheetContent>
      </Sheet>
    </div>
  )
}

function CalendarDayItem({ item, onToggle, onEditEvent, onDeleteEvent }: {
  item: CalItem
  onToggle: (item: CalItem) => void
  onEditEvent: (id: string) => void
  onDeleteEvent: (id: string) => void
}) {
  const done = item.kind === 'expense' ? item.is_paid : item.kind === 'income' ? item.is_received : true
  return (
    <div className="px-4 py-3 flex items-start gap-3 group hover:bg-slate-50/50">
      {item.kind !== 'event' ? (
        <button onClick={() => onToggle(item)}
          className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all mt-0.5',
            done ? 'bg-emerald-500 border-emerald-500 text-white'
                 : item.kind === 'expense' ? 'border-red-300 hover:border-red-500'
                 : 'border-emerald-300 hover:border-emerald-500'
          )}>
          {done && <Check className="w-2.5 h-2.5" />}
        </button>
      ) : (
        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-medium', done && item.kind !== 'event' && 'line-through text-slate-400')}>
          {item.kind === 'event' ? item.title : item.label}
        </p>
        {item.kind === 'income' && item.projectName && (
          <p className="text-[10px] text-slate-400 truncate">{item.projectName}</p>
        )}
        {item.notes && (
          <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.notes}</p>
        )}
        {item.kind !== 'event' && (
          <p className={cn('text-xs font-black mt-0.5', item.kind === 'expense' ? 'text-red-600' : 'text-emerald-700', done && 'text-slate-400 line-through')}>
            {fmt(item.amount)}
          </p>
        )}
        {item.kind === 'event' && item.end_time && (
          <p className="text-[10px] text-slate-400">
            {format(new Date(item.date), 'HH:mm')} — {format(new Date(item.end_time), 'HH:mm')}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className={cn(
          'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
          item.kind === 'expense' ? 'bg-red-100 text-red-600' :
          item.kind === 'income' ? 'bg-emerald-100 text-emerald-700' :
          'bg-blue-100 text-blue-700'
        )}>
          {item.kind === 'expense' ? 'הוצאה' : item.kind === 'income' ? 'הכנסה' : 'פגישה'}
        </span>
        {item.kind === 'event' && (
          <>
            <button onClick={() => onEditEvent(item.id)}
              className="w-6 h-6 rounded text-slate-300 hover:text-amber-500 hover:bg-amber-50 flex items-center justify-center">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => onDeleteEvent(item.id)}
              className="w-6 h-6 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 flex items-center justify-center">
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function CalendarListItem({ item, onToggle, onEditEvent, onDeleteEvent }: {
  item: CalItem
  onToggle: (item: CalItem) => void
  onEditEvent: (id: string) => void
  onDeleteEvent: (id: string) => void
}) {
  const done = item.kind === 'expense' ? item.is_paid : item.kind === 'income' ? item.is_received : true
  const today = new Date()
  const overdue = !done && item.kind !== 'event' && isBefore(item.date, today)

  return (
    <div className={cn(
      'flex items-center gap-4 px-5 py-3 group hover:bg-slate-50/50 transition-colors',
      overdue && 'bg-red-50/20'
    )}>
      {/* Date badge */}
      <div className={cn(
        'w-12 text-center rounded-xl py-1.5 shrink-0',
        item.kind === 'expense' ? (done ? 'bg-slate-100' : overdue ? 'bg-red-100' : 'bg-red-50') :
        item.kind === 'income' ? (done ? 'bg-slate-100' : overdue ? 'bg-red-100' : 'bg-emerald-50') :
        'bg-blue-50'
      )}>
        <p className={cn('text-[9px] font-bold leading-none',
          item.kind === 'expense' ? (overdue ? 'text-red-400' : 'text-red-400') :
          item.kind === 'income' ? (overdue ? 'text-red-400' : 'text-emerald-500') : 'text-blue-400'
        )}>
          {format(item.date, 'MMM', { locale: he })}
        </p>
        <p className={cn('text-base font-black leading-tight',
          done ? 'text-slate-400' :
          overdue ? 'text-red-600' :
          item.kind === 'expense' ? 'text-red-700' :
          item.kind === 'income' ? 'text-emerald-700' : 'text-blue-700'
        )}>
          {format(item.date, 'd')}
        </p>
      </div>

      {/* Toggle for payments */}
      {item.kind !== 'event' && (
        <button onClick={() => onToggle(item)}
          className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
            done ? 'bg-emerald-500 border-emerald-500 text-white'
                 : item.kind === 'expense' ? 'border-red-300 hover:border-red-500'
                 : 'border-emerald-300 hover:border-emerald-500'
          )}>
          {done && <Check className="w-2.5 h-2.5" />}
        </button>
      )}
      {item.kind === 'event' && (
        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', done && item.kind !== 'event' && 'line-through text-slate-400')}>
          {item.kind === 'event' ? item.title : item.label}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
          {item.kind === 'income' && item.projectName && <span>{item.projectName}</span>}
          {item.notes && <span className="truncate max-w-[200px]">{item.notes}</span>}
          {item.kind === 'event' && item.end_time && (
            <span>{format(item.date, 'HH:mm')} — {format(new Date(item.end_time), 'HH:mm')}</span>
          )}
        </div>
      </div>

      {/* Amount / type badge */}
      {item.kind !== 'event' ? (
        <p className={cn('font-black text-sm shrink-0',
          done ? 'text-slate-400 line-through' :
          overdue ? 'text-red-600' :
          item.kind === 'expense' ? 'text-red-700' : 'text-emerald-700'
        )}>
          {item.kind === 'income' ? '+' : '-'}{fmt(item.amount)}
        </p>
      ) : (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 shrink-0">
          {item.type === 'meeting' ? 'פגישה' : item.type === 'reminder' ? 'תזכורת' : 'אחר'}
        </span>
      )}

      {item.kind === 'event' && (
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEditEvent(item.id)}
            className="w-7 h-7 rounded-lg text-slate-200 hover:text-amber-500 hover:bg-amber-50 flex items-center justify-center">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDeleteEvent(item.id)}
            className="w-7 h-7 rounded-lg text-slate-200 hover:text-red-400 hover:bg-red-50 flex items-center justify-center">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

function EventForm({ form, setForm, onSubmit, onCancel, saving, submitLabel }: {
  form: { title: string; start_time: string; end_time: string; notes: string; type: string }
  setForm: React.Dispatch<React.SetStateAction<any>>
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  saving: boolean
  submitLabel: string
}) {
  return (
    <form onSubmit={onSubmit} className="pt-5 space-y-4">
      <div className="space-y-2">
        <Label className="font-medium text-slate-700">כותרת <span className="text-red-400">*</span></Label>
        <Input value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))}
          placeholder="לדוגמה: פגישה עם עו״ד" className="h-10" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">תאריך ושעה <span className="text-red-400">*</span></Label>
          <Input type="datetime-local" value={form.start_time}
            onChange={e => setForm((f: any) => ({ ...f, start_time: e.target.value }))}
            className="h-10" required />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">סיום (אופציונלי)</Label>
          <Input type="datetime-local" value={form.end_time}
            onChange={e => setForm((f: any) => ({ ...f, end_time: e.target.value }))}
            className="h-10" />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-medium text-slate-700">סוג</Label>
        <Select value={form.type} onValueChange={v => setForm((f: any) => ({ ...f, type: v ?? 'meeting' }))}>
          <SelectTrigger className="h-10">
            <SelectValue>
              {form.type === 'meeting' ? 'פגישה' : form.type === 'reminder' ? 'תזכורת' : 'אחר'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="meeting">פגישה</SelectItem>
            <SelectItem value="reminder">תזכורת</SelectItem>
            <SelectItem value="other">אחר</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="font-medium text-slate-700">הערות</Label>
        <Input value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
          placeholder="פרטים נוספים..." className="h-10" />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">ביטול</Button>
        <Button type="submit" disabled={saving || !form.title || !form.start_time}
          className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-bold">
          {saving ? 'שומר...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
