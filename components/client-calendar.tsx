'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import type { ClientSchema } from '@/lib/supabase'
import {
  Calendar, ChevronRight, ChevronLeft, Clock, Users, Plus, Table2,
  X, Link2, Trash2, CalendarDays, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import { he } from 'date-fns/locale'
import { CreateMeetingDialog } from '@/components/create-meeting-dialog'
import { CreateTaskDialog } from '@/components/create-task-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'

// ── Types ──────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week' | 'day'

type EventType = 'reminder' | 'meeting' | 'table'

interface CalendarEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  time?: string // HH:MM
  eventType: EventType
  is_completed?: boolean
  priority?: string
  color?: string // for table events
  tableName?: string
  extraInfo?: string // secondary info to display
}

interface TableCalendarLink {
  schemaId: string
  moduleType: string
  branchName: string | null
  dateColumn: string
  titleColumn: string
  detailsColumn?: string | null
  color: string
  label: string
}

const TABLE_COLORS = [
  { value: 'green', label: 'ירוק', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { value: 'orange', label: 'כתום', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  { value: 'purple', label: 'סגול', bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  { value: 'teal', label: 'טורקיז', bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
  { value: 'rose', label: 'ורוד', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  { value: 'amber', label: 'צהוב', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
]

const priorityStyles: Record<string, string> = {
  'דחוף': 'bg-red-100 text-red-700 border-red-200',
  'רגיל': 'bg-blue-100 text-blue-700 border-blue-200',
  'נמוך': 'bg-slate-100 text-slate-600 border-slate-200',
}

const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

function getColorStyles(color: string) {
  return TABLE_COLORS.find(c => c.value === color) || TABLE_COLORS[0]
}

// ── localStorage helpers ───────────────────────────────────────────────────────

function getLinksKey(clientId: string) {
  return `calendar_linked_modules_${clientId}`
}

function loadLinks(clientId: string): TableCalendarLink[] {
  try {
    const raw = localStorage.getItem(getLinksKey(clientId))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveLinks(clientId: string, links: TableCalendarLink[]) {
  localStorage.setItem(getLinksKey(clientId), JSON.stringify(links))
}

// ── Link Dialog ────────────────────────────────────────────────────────────────

interface LinkDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  clientId: string
  schemas: ClientSchema[]
  existingLinks: TableCalendarLink[]
  initialSchemaId?: string
  onSave: (link: TableCalendarLink) => void
}

function LinkTableDialog({ open, onOpenChange, schemas, existingLinks, initialSchemaId, onSave }: LinkDialogProps) {
  const [selectedSchemaId, setSelectedSchemaId] = useState(initialSchemaId || '')
  const [dateColumn, setDateColumn] = useState('')
  const [titleColumn, setTitleColumn] = useState('')
  const [detailsColumn, setDetailsColumn] = useState<string>('none')
  const [color, setColor] = useState('green')

  const schema = schemas.find(s => s.id === selectedSchemaId)

  const dateColumns = schema?.columns.filter(c => c.type === 'date') || []
  const allColumns = schema?.columns || []

  useEffect(() => {
    if (schema) {
      const defaultDate = schema.date_column || dateColumns[0]?.name || ''
      setDateColumn(defaultDate)
      const defaultTitle = schema.description_column || allColumns.find(c => c.type === 'text')?.name || allColumns[0]?.name || ''
      setTitleColumn(defaultTitle)
      setDetailsColumn('none')
    }
  }, [selectedSchemaId, schema?.id])

  useEffect(() => {
    if (initialSchemaId) setSelectedSchemaId(initialSchemaId)
  }, [initialSchemaId, open])

  const alreadyLinked = existingLinks.some(l => l.schemaId === selectedSchemaId)

  const handleSave = () => {
    if (!schema || !dateColumn || !titleColumn) return
    onSave({
      schemaId: schema.id,
      moduleType: schema.module_name,
      branchName: schema.branch_name || null,
      dateColumn,
      titleColumn,
      detailsColumn: detailsColumn === 'none' ? null : detailsColumn,
      color,
      label: schema.module_name,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-navy font-black">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <Link2 className="h-4 w-4" />
            </div>
            קישור טבלה ללוח שנה
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Select module */}
          <div>
            <label className="text-xs font-black text-grey uppercase tracking-widest mb-2 block">טבלה / מודול</label>
            <Select value={selectedSchemaId} onValueChange={setSelectedSchemaId}>
              <SelectTrigger className="rounded-xl h-11 font-bold">
                <SelectValue placeholder="בחר טבלה..." />
              </SelectTrigger>
              <SelectContent>
                {schemas.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-bold">{s.module_name}</span>
                    {s.branch_name && <span className="text-grey text-xs mr-2">({s.branch_name})</span>}
                    {existingLinks.some(l => l.schemaId === s.id) && (
                      <span className="text-emerald-600 text-xs mr-2">✓ מקושר</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {schema && (
            <>
              {dateColumns.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm font-bold text-amber-700">
                  לטבלה זו אין עמודות תאריך. הוסף עמודת תאריך כדי לקשר ללוח שנה.
                </div>
              ) : (
                <>
                  {/* Date column */}
                  <div>
                    <label className="text-xs font-black text-grey uppercase tracking-widest mb-2 block">עמודת תאריך</label>
                    <Select value={dateColumn} onValueChange={setDateColumn}>
                      <SelectTrigger className="rounded-xl h-11 font-bold">
                        <SelectValue placeholder="בחר עמודת תאריך..." />
                      </SelectTrigger>
                      <SelectContent>
                        {dateColumns.map(c => (
                          <SelectItem key={c.name} value={c.name}>
                            <span className="font-bold">{c.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Title column */}
                  <div>
                    <label className="text-xs font-black text-grey uppercase tracking-widest mb-2 block">עמודת כותרת</label>
                    <Select value={titleColumn} onValueChange={setTitleColumn}>
                      <SelectTrigger className="rounded-xl h-11 font-bold">
                        <SelectValue placeholder="בחר עמודת כותרת..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allColumns.map(c => (
                          <SelectItem key={c.name} value={c.name}>
                            <span className="font-bold">{c.label}</span>
                            <span className="text-grey text-xs mr-2">({c.type})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Details column */}
                  <div>
                    <label className="text-xs font-black text-grey uppercase tracking-widest mb-2 block">
                      עמודת פרטים <span className="font-normal normal-case tracking-normal text-grey/70">(אופציונלי — יוצג מתחת לכותרת)</span>
                    </label>
                    <Select value={detailsColumn} onValueChange={setDetailsColumn}>
                      <SelectTrigger className="rounded-xl h-11 font-bold">
                        <SelectValue placeholder="ללא פרטים נוספים" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-grey">ללא פרטים נוספים</span>
                        </SelectItem>
                        {allColumns.filter(c => c.name !== titleColumn).map(c => (
                          <SelectItem key={c.name} value={c.name}>
                            <span className="font-bold">{c.label}</span>
                            <span className="text-grey text-xs mr-2">({c.type})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="text-xs font-black text-grey uppercase tracking-widest mb-2 block">צבע</label>
                    <div className="flex gap-2 flex-wrap">
                      {TABLE_COLORS.map(c => (
                        <button
                          key={c.value}
                          onClick={() => setColor(c.value)}
                          className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center transition-all border-2",
                            c.dot,
                            color === c.value ? 'border-navy scale-110 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                          )}
                        >
                          {color === c.value && <Check className="h-4 w-4 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {alreadyLinked && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-700">
                      טבלה זו כבר מקושרת. שמירה תעדכן את הקישור הקיים.
                    </div>
                  )}

                  <Button
                    onClick={handleSave}
                    disabled={!dateColumn || !titleColumn}
                    className="w-full rounded-xl h-11 bg-navy hover:bg-navy/90 text-white font-black"
                  >
                    <Link2 className="h-4 w-4 ml-2" />
                    קשר ללוח שנה
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── CalendarLinkButton (for use in module tabs) ────────────────────────────────

interface CalendarLinkButtonProps {
  clientId: string
  schema: ClientSchema
  allSchemas: ClientSchema[]
}

export function CalendarLinkButton({ clientId, schema, allSchemas }: CalendarLinkButtonProps) {
  const { showToast } = useToast()
  const [links, setLinks] = useState<TableCalendarLink[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    setLinks(loadLinks(clientId))
  }, [clientId])

  const isLinked = links.some(l => l.schemaId === schema.id)

  const handleSave = (link: TableCalendarLink) => {
    const newLinks = [...links.filter(l => l.schemaId !== link.schemaId), link]
    setLinks(newLinks)
    saveLinks(clientId, newLinks)
    showToast('success', `הטבלה "${link.label}" קושרה ללוח השנה`)
    setDialogOpen(false)
  }

  const handleUnlink = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newLinks = links.filter(l => l.schemaId !== schema.id)
    setLinks(newLinks)
    saveLinks(clientId, newLinks)
    showToast('info', 'הוסר מלוח השנה')
  }

  const dateColumns = schema.columns.filter(c => c.type === 'date')
  if (dateColumns.length === 0) return null

  return (
    <>
      {isLinked ? (
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>בלוח שנה</span>
          </div>
          <button
            onClick={handleUnlink}
            title="הסר מלוח שנה"
            className="p-1.5 rounded-lg text-grey hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-border/60 text-grey hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 text-xs font-bold transition-all"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          הוסף ללוח שנה
        </button>
      )}

      <LinkTableDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        schemas={allSchemas}
        existingLinks={links}
        initialSchemaId={schema.id}
        onSave={handleSave}
      />
    </>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface ClientCalendarProps {
  clientId: string
  clientName: string
  schemas: ClientSchema[]
  initialLinkSchemaId?: string // pre-open link dialog for this schema
}

export function ClientCalendar({ clientId, clientName, schemas, initialLinkSchemaId }: ClientCalendarProps) {
  const { showToast } = useToast()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [links, setLinks] = useState<TableCalendarLink[]>([])
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkInitialSchema, setLinkInitialSchema] = useState<string | undefined>(undefined)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  // Load localStorage links on mount
  useEffect(() => {
    setLinks(loadLinks(clientId))
    if (initialLinkSchemaId) {
      setLinkInitialSchema(initialLinkSchemaId)
      setLinkDialogOpen(true)
    }
  }, [clientId, initialLinkSchemaId])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      let startDate: Date, endDate: Date
      if (viewMode === 'month') {
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      } else if (viewMode === 'week') {
        startDate = startOfWeek(currentDate, { weekStartsOn: 0 })
        endDate = addDays(startDate, 6)
      } else {
        startDate = new Date(currentDate); startDate.setHours(0, 0, 0, 0)
        endDate = new Date(currentDate); endDate.setHours(23, 59, 59, 999)
      }
      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]

      // Load reminders & meetings in parallel
      const [remindersRes, meetingsRes] = await Promise.all([
        supabase.from('reminders').select('*').eq('client_id', clientId).gte('due_date', startStr).lte('due_date', endStr),
        supabase.from('meeting_logs').select('*').eq('client_id', clientId).gte('meeting_date', startStr).lte('meeting_date', endStr),
      ])

      const reminderEvents: CalendarEvent[] = (remindersRes.data || []).map(r => ({
        id: r.id, title: r.title,
        date: r.due_date.split('T')[0],
        time: r.due_date.includes('T') ? r.due_date.split('T')[1]?.substring(0, 5) : undefined,
        eventType: 'reminder', is_completed: r.is_completed, priority: r.priority,
      }))

      const meetingEvents: CalendarEvent[] = (meetingsRes.data || []).map(m => ({
        id: m.id, title: m.subject,
        date: m.meeting_date.split('T')[0],
        time: m.meeting_date.includes('T') ? m.meeting_date.split('T')[1]?.substring(0, 5) : undefined,
        eventType: 'meeting',
      }))

      // Load table records from linked modules
      const tableEvents: CalendarEvent[] = []
      const currentLinks = loadLinks(clientId) // fresh from localStorage
      for (const link of currentLinks) {
        const { data: records } = await supabase
          .from('client_data_records')
          .select('*')
          .eq('client_id', clientId)
          .eq('module_type', link.moduleType)

        if (!records) continue

        const filteredRecords = records.filter(rec => {
          const dateVal = rec.data?.[link.dateColumn]
          if (!dateVal) return false
          const dateStr = String(dateVal).split('T')[0]
          return dateStr >= startStr && dateStr <= endStr
        })

        const colorConfig = getColorStyles(link.color)
        for (const rec of filteredRecords) {
          const dateVal = String(rec.data?.[link.dateColumn] || '')
          const titleVal = String(rec.data?.[link.titleColumn] || '—')
          // Use the explicitly configured details column
          let extraInfo: string | undefined
          if (link.detailsColumn) {
            const detailsVal = rec.data?.[link.detailsColumn]
            if (detailsVal !== undefined && detailsVal !== null && String(detailsVal).trim() !== '') {
              const detailsColDef = schemas.find(s => s.id === link.schemaId)?.columns.find(c => c.name === link.detailsColumn)
              extraInfo = detailsColDef ? `${detailsColDef.label}: ${detailsVal}` : String(detailsVal)
            }
          }

          tableEvents.push({
            id: rec.id,
            title: `${link.label}: ${titleVal}`,
            date: dateVal.split('T')[0],
            time: dateVal.includes('T') ? dateVal.split('T')[1]?.substring(0, 5) : undefined,
            eventType: 'table',
            color: link.color,
            tableName: link.label,
            extraInfo,
          })
        }
      }

      const all = [...reminderEvents, ...meetingEvents, ...tableEvents]
        .sort((a, b) => {
          const da = a.date + (a.time || '00:00')
          const db = b.date + (b.time || '00:00')
          return da.localeCompare(db)
        })
      setEvents(all)
    } catch (err) {
      console.error('Error loading calendar data:', err)
    } finally {
      setLoading(false)
    }
  }, [clientId, currentDate, viewMode, links])

  useEffect(() => { loadData() }, [loadData])

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const e of events) {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
    return map
  }, [events])

  const getEventsForDate = (date: Date | null) => {
    if (!date) return []
    return eventsByDate[format(date, 'yyyy-MM-dd')] || []
  }

  const navigate = (dir: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const d = new Date(prev)
      if (viewMode === 'month') d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1))
      else if (viewMode === 'week') d.setDate(d.getDate() + (dir === 'next' ? 7 : -7))
      else d.setDate(d.getDate() + (dir === 'next' ? 1 : -1))
      return d
    })
  }

  const getHeaderLabel = () => {
    if (viewMode === 'month') return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    if (viewMode === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 })
      return `${format(ws, 'd/M')} – ${format(addDays(ws, 6), 'd/M yyyy')}`
    }
    return format(currentDate, 'EEEE, d בMMMM yyyy', { locale: he })
  }

  const daysInMonth = useMemo(() => {
    const y = currentDate.getFullYear(), m = currentDate.getMonth()
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    const days: (Date | null)[] = []
    for (let i = 0; i < first.getDay(); i++) days.push(null)
    for (let i = 1; i <= last.getDate(); i++) days.push(new Date(y, m, i))
    return days
  }, [currentDate])

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [currentDate])

  const hours = Array.from({ length: 14 }, (_, i) => i + 7)

  // Add/update a link
  const handleSaveLink = (link: TableCalendarLink) => {
    const newLinks = [...links.filter(l => l.schemaId !== link.schemaId), link]
    setLinks(newLinks)
    saveLinks(clientId, newLinks)
    showToast('success', `הטבלה "${link.label}" קושרה ללוח השנה`)
    loadData()
  }

  const handleRemoveLink = (schemaId: string) => {
    const newLinks = links.filter(l => l.schemaId !== schemaId)
    setLinks(newLinks)
    saveLinks(clientId, newLinks)
    showToast('info', 'הקישור הוסר')
    loadData()
  }

  // ── Event pill renderer ──
  const renderEventPill = (event: CalendarEvent, compact = true) => {
    const colorConfig = event.color ? getColorStyles(event.color) : null
    return (
      <div
        key={`${event.eventType}-${event.id}`}
        className={cn(
          "text-[10px] p-1 px-1.5 rounded-lg truncate font-bold border shadow-sm",
          compact ? '' : 'text-xs px-2 py-1.5',
          event.eventType === 'meeting'
            ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
            : event.eventType === 'reminder'
              ? event.is_completed
                ? 'bg-slate-50 text-grey line-through border-transparent opacity-50'
                : priorityStyles[event.priority || 'רגיל']
              : colorConfig
                ? `${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}`
                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
        )}
      >
        <div className="flex items-center gap-1">
          {event.eventType === 'meeting'
            ? <Users className="h-2.5 w-2.5 shrink-0" />
            : event.eventType === 'table'
              ? <Table2 className="h-2.5 w-2.5 shrink-0" />
              : <Clock className="h-2.5 w-2.5 shrink-0" />
          }
          <span className="truncate">{event.title}</span>
        </div>
      </div>
    )
  }

  // ── Day detail panel (shows on day click in month view) ──
  const selectedDayEvents = selectedDay ? (eventsByDate[format(selectedDay, 'yyyy-MM-dd')] || []) : []

  return (
    <div dir="rtl" className="space-y-6">

      {/* ── Header controls ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="bg-white/60 border border-border/50 rounded-xl p-1 flex gap-1">
            {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                  viewMode === mode ? "bg-navy text-white shadow-sm" : "text-grey hover:text-navy hover:bg-slate-50"
                )}
              >
                {mode === 'day' ? 'יום' : mode === 'week' ? 'שבוע' : 'חודש'}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('prev')} className="h-9 w-9 rounded-xl bg-white border border-slate-200/50">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-bold min-w-[140px] text-center text-navy">{getHeaderLabel()}</span>
            <Button variant="ghost" size="icon" onClick={() => navigate('next')} className="h-9 w-9 rounded-xl bg-white border border-slate-200/50">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="rounded-xl text-xs font-bold h-9">
              היום
            </Button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <CreateMeetingDialog clientId={clientId} clientName={clientName} onCreated={loadData} trigger={
            <Button size="sm" className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-3 gap-1.5 text-xs font-bold">
              <Users className="h-3.5 w-3.5" />פגישה
            </Button>
          } />
          <CreateTaskDialog clientId={clientId} clientName={clientName} onCreated={loadData} trigger={
            <Button size="sm" variant="outline" className="rounded-xl h-9 px-3 gap-1.5 text-xs font-bold">
              <Clock className="h-3.5 w-3.5" />משימה
            </Button>
          } />
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setLinkInitialSchema(undefined); setLinkDialogOpen(true) }}
            className="rounded-xl h-9 px-3 gap-1.5 text-xs font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <Table2 className="h-3.5 w-3.5" />קשר טבלה
          </Button>
        </div>
      </div>

      {/* ── Linked tables chips ── */}
      {links.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-grey uppercase tracking-widest">טבלאות מקושרות:</span>
          {links.map(link => {
            const c = getColorStyles(link.color)
            return (
              <div key={link.schemaId} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border", c.bg, c.text, c.border)}>
                <div className={cn("w-2 h-2 rounded-full", c.dot)} />
                {link.label}
                {link.branchName && <span className="opacity-60">({link.branchName})</span>}
                <button onClick={() => handleRemoveLink(link.schemaId)} className="mr-1 opacity-60 hover:opacity-100 transition-opacity">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="h-[400px] bg-white/40 rounded-2xl animate-pulse border border-border/30" />
      )}

      {!loading && (
        <>
          {/* ══ MONTH VIEW ══ */}
          {viewMode === 'month' && (
            <div className="bg-white/60 border border-border/40 rounded-2xl p-4 shadow-sm">
              <div className="grid grid-cols-7 gap-1">
                {dayNames.map(d => (
                  <div key={d} className="text-center font-bold text-grey text-[10px] uppercase tracking-wider py-2">{d}</div>
                ))}
                {daysInMonth.map((date, i) => {
                  const dayEvents = getEventsForDate(date)
                  const isToday = date && isSameDay(date, new Date())
                  const isSelected = date && selectedDay && isSameDay(date, selectedDay)
                  const isPast = date && date < new Date() && !isToday
                  return (
                    <div
                      key={i}
                      onClick={() => date && setSelectedDay(isSelected ? null : date)}
                      className={cn(
                        "min-h-[90px] rounded-xl p-1.5 transition-all border cursor-pointer",
                        !date && "bg-transparent border-transparent cursor-default",
                        date && isToday && "bg-blue-50/60 border-blue-200 ring-1 ring-blue-100",
                        date && isSelected && !isToday && "bg-slate-100 border-slate-300 ring-1 ring-slate-200",
                        date && isPast && !isToday && !isSelected && "opacity-60",
                        date && !isPast && !isToday && !isSelected && "bg-white/40 border-border/30 hover:border-primary/30 hover:bg-white/70",
                      )}
                    >
                      {date && (
                        <>
                          <div className={cn("text-[11px] font-black mb-1 flex items-center justify-between", isToday ? "text-blue-600" : "text-grey")}>
                            <span>{date.getDate()}</span>
                            {isToday && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 3).map(e => renderEventPill(e))}
                            {dayEvents.length > 3 && (
                              <div className="text-[9px] text-grey font-bold text-center">+{dayEvents.length - 3}</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Selected day panel */}
              {selectedDay && (
                <div className="mt-4 pt-4 border-t border-border/40">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-black text-navy flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {format(selectedDay, 'EEEE, d בMMMM', { locale: he })}
                      <span className="text-xs text-grey font-bold bg-slate-100 px-2 py-0.5 rounded-full">{selectedDayEvents.length} אירועים</span>
                    </h3>
                    <button onClick={() => setSelectedDay(null)} className="text-grey hover:text-navy">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {selectedDayEvents.length === 0 ? (
                    <p className="text-sm text-grey font-bold text-center py-4">אין אירועים ביום זה</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedDayEvents.map(event => (
                        <EventRow key={`${event.eventType}-${event.id}`} event={event} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ WEEK VIEW ══ */}
          {viewMode === 'week' && (
            <div className="bg-white/60 border border-border/40 rounded-2xl p-4 shadow-sm overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-8 gap-2 mb-3">
                  <div className="text-[10px] font-bold text-grey uppercase tracking-widest py-2">שעה</div>
                  {weekDays.map(day => {
                    const isToday = isSameDay(day, new Date())
                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => { setCurrentDate(day); setViewMode('day') }}
                        className={cn("text-center py-2 rounded-xl cursor-pointer transition-all", isToday ? "bg-navy text-white" : "hover:bg-slate-50")}
                      >
                        <div className="text-[10px] font-bold uppercase tracking-widest">{format(day, 'EEE', { locale: he })}</div>
                        <div className={cn("text-base font-black", isToday ? "text-white" : "text-navy")}>{format(day, 'd')}</div>
                      </div>
                    )
                  })}
                </div>
                {hours.map(hour => (
                  <div key={hour} className="grid grid-cols-8 gap-2 border-t border-border/20">
                    <div className="text-[10px] font-bold text-grey py-2 text-center">{`${String(hour).padStart(2, '0')}:00`}</div>
                    {weekDays.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd')
                      const hourEvents = (eventsByDate[dateStr] || []).filter(e => {
                        if (!e.time) return false
                        return parseInt(e.time.split(':')[0]) === hour
                      })
                      return (
                        <div key={`${dateStr}-${hour}`} className="min-h-[44px] py-0.5 space-y-0.5">
                          {hourEvents.map(e => renderEventPill(e))}
                        </div>
                      )
                    })}
                  </div>
                ))}
                {/* All-day events */}
                {(() => {
                  const allDay = events.filter(e => !e.time)
                  if (!allDay.length) return null
                  return (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <p className="text-[10px] font-black text-grey uppercase tracking-widest mb-2">ללא שעה</p>
                      <div className="grid grid-cols-8 gap-2">
                        <div />
                        {weekDays.map(day => {
                          const dateStr = format(day, 'yyyy-MM-dd')
                          const dayAllDay = allDay.filter(e => e.date === dateStr)
                          return (
                            <div key={dateStr} className="space-y-0.5">
                              {dayAllDay.map(e => renderEventPill(e))}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* ══ DAY VIEW ══ */}
          {viewMode === 'day' && (
            <div className="bg-white/60 border border-border/40 rounded-2xl p-4 shadow-sm">
              <div className="space-y-1">
                {hours.map(hour => {
                  const dateStr = format(currentDate, 'yyyy-MM-dd')
                  const hourEvents = (eventsByDate[dateStr] || []).filter(e =>
                    e.time && parseInt(e.time.split(':')[0]) === hour
                  )
                  return (
                    <div key={hour} className="flex gap-4 border-t border-border/20 py-1.5">
                      <div className="w-14 shrink-0 text-xs font-bold text-grey text-left pt-1.5">
                        {`${String(hour).padStart(2, '0')}:00`}
                      </div>
                      <div className="flex-1 min-h-[44px] space-y-1.5 py-0.5">
                        {hourEvents.map(event => (
                          <EventRow key={`${event.eventType}-${event.id}`} event={event} />
                        ))}
                      </div>
                    </div>
                  )
                })}
                {/* All-day events */}
                {(() => {
                  const dateStr = format(currentDate, 'yyyy-MM-dd')
                  const allDay = (eventsByDate[dateStr] || []).filter(e => !e.time)
                  if (!allDay.length) return null
                  return (
                    <div className="mt-4 pt-4 border-t border-border/40">
                      <p className="text-xs font-black text-grey uppercase tracking-widest mb-3">ללא שעה מוגדרת</p>
                      <div className="space-y-2">
                        {allDay.map(event => <EventRow key={`${event.eventType}-${event.id}`} event={event} />)}
                      </div>
                    </div>
                  )
                })()}
              </div>
              {!events.length && (
                <div className="text-center py-12">
                  <Calendar className="h-10 w-10 text-grey/30 mx-auto mb-3" />
                  <p className="text-grey font-bold text-sm">אין אירועים ביום זה</p>
                </div>
              )}
            </div>
          )}

          {/* ── Legend ── */}
          <div className="flex items-center gap-4 flex-wrap px-1">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-indigo-100 border border-indigo-200" />
              <span className="text-[11px] font-bold text-grey">פגישות</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-200" />
              <span className="text-[11px] font-bold text-grey">משימות</span>
            </div>
            {links.map(link => {
              const c = getColorStyles(link.color)
              return (
                <div key={link.schemaId} className="flex items-center gap-1.5">
                  <div className={cn("w-3 h-3 rounded-sm border", c.bg, c.border)} />
                  <span className="text-[11px] font-bold text-grey">{link.label}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Link dialog ── */}
      <LinkTableDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        clientId={clientId}
        schemas={schemas}
        existingLinks={links}
        initialSchemaId={linkInitialSchema}
        onSave={handleSaveLink}
      />
    </div>
  )
}

// ── Event Row (detailed) ───────────────────────────────────────────────────────

function EventRow({ event }: { event: CalendarEvent }) {
  const colorConfig = event.color ? getColorStyles(event.color) : null

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl border transition-all",
      event.eventType === 'meeting'
        ? 'bg-indigo-50/60 border-indigo-100'
        : event.eventType === 'table' && colorConfig
          ? `${colorConfig.bg} ${colorConfig.border}`
          : event.is_completed
            ? 'bg-slate-50 border-slate-100 opacity-60'
            : 'bg-white border-border/40'
    )}>
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
        event.eventType === 'meeting'
          ? 'bg-indigo-100 text-indigo-600'
          : event.eventType === 'table' && colorConfig
            ? `${colorConfig.dot} bg-opacity-20 text-white`
            : 'bg-blue-100 text-blue-600'
      )}>
        {event.eventType === 'meeting'
          ? <Users className="h-4 w-4" />
          : event.eventType === 'table'
            ? <Table2 className="h-4 w-4" />
            : event.is_completed
              ? <Check className="h-4 w-4" />
              : <Clock className="h-4 w-4" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-bold text-navy truncate", event.is_completed && "line-through text-grey")}>
          {event.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {event.time && <span className="text-[11px] font-bold text-grey">{event.time}</span>}
          {event.extraInfo && <span className="text-[11px] text-grey truncate">{event.extraInfo}</span>}
          {event.tableName && (
            <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full", colorConfig ? `${colorConfig.bg} ${colorConfig.text}` : '')}>
              {event.tableName}
            </span>
          )}
        </div>
      </div>

      {event.priority && event.eventType === 'reminder' && (
        <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 border", priorityStyles[event.priority])}>
          {event.priority}
        </span>
      )}
    </div>
  )
}
