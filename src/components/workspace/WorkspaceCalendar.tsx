'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { he } from 'date-fns/locale'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  List,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { WorkspaceCalendarEvent } from '@/types/workspace-calendar'

export interface CalendarClientOption {
  id: string
  name: string
  email: string | null
}

type CalendarView = 'month' | 'week' | 'agenda'

interface WorkspaceCalendarProps {
  clients: CalendarClientOption[]
  initialClientId?: string
  compact?: boolean
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'שגיאה לא צפויה'
}

function eventDate(value: string): Date {
  return value.length === 10 ? startOfDay(parseISO(value)) : parseISO(value)
}

function EditorDialog({
  event,
  initialDate,
  clients,
  initialClientId,
  onClose,
  onSaved,
  onDeleted,
}: {
  event: WorkspaceCalendarEvent | null
  initialDate: Date
  clients: CalendarClientOption[]
  initialClientId?: string
  onClose: () => void
  onSaved: (event: WorkspaceCalendarEvent) => void
  onDeleted: (eventId: string) => void
}) {
  const initialStart = event ? eventDate(event.start) : addHours(startOfDay(initialDate), 9)
  const initialEnd = event ? eventDate(event.end) : addHours(initialStart, 1)
  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [allDay, setAllDay] = useState(event?.allDay ?? false)
  const [start, setStart] = useState(format(initialStart, "yyyy-MM-dd'T'HH:mm"))
  const [end, setEnd] = useState(format(initialEnd, "yyyy-MM-dd'T'HH:mm"))
  const [clientId, setClientId] = useState(event?.clientId ?? initialClientId ?? 'none')
  const [reminder, setReminder] = useState(String(event?.reminders[0] ?? 30))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function save() {
    if (!title.trim()) return toast.error('יש להזין כותרת לפגישה')
    setSaving(true)
    try {
      const allDayStart = start.slice(0, 10)
      const requestedAllDayEnd = end.slice(0, 10)
      const allDayEnd = requestedAllDayEnd <= allDayStart
        ? format(addDays(parseISO(allDayStart), 1), 'yyyy-MM-dd')
        : requestedAllDayEnd
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        start: allDay ? allDayStart : new Date(start).toISOString(),
        end: allDay ? allDayEnd : new Date(end).toISOString(),
        allDay,
        clientId: clientId === 'none' ? null : clientId,
        reminders: [Number(reminder)],
        attendees: [],
        ...(event?.etag ? { etag: event.etag } : {}),
      }
      const url = event
        ? `/api/workspace/calendar/events/${encodeURIComponent(event.id)}`
        : '/api/workspace/calendar/events'
      const response = await fetch(url, {
        method: event ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'שמירת הפגישה נכשלה')
      onSaved(result.event)
      toast.success(event ? 'הפגישה עודכנה' : 'הפגישה נקבעה ביומן Google')
      onClose()
    } catch (error: unknown) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!event || !window.confirm('למחוק את הפגישה מיומן Google?')) return
    setDeleting(true)
    try {
      const query = event.etag ? `?etag=${encodeURIComponent(event.etag)}` : ''
      const response = await fetch(
        `/api/workspace/calendar/events/${encodeURIComponent(event.id)}${query}`,
        { method: 'DELETE' }
      )
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error ?? 'מחיקת הפגישה נכשלה')
      }
      onDeleted(event.id)
      toast.success('הפגישה נמחקה')
      onClose()
    } catch (error: unknown) {
      toast.error(errorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle>{event ? 'עריכת פגישה' : 'פגישה חדשה'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5"><Label>כותרת</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>לקוח</Label>
            <Select value={clientId} onValueChange={(value) => setClientId(value ?? 'none')}>
              <SelectTrigger><SelectValue placeholder="ללא לקוח" /></SelectTrigger>
              <SelectContent><SelectItem value="none">ללא לקוח</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3"><Label>אירוע לכל היום</Label><Switch checked={allDay} onCheckedChange={setAllDay} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>התחלה</Label><Input type={allDay ? 'date' : 'datetime-local'} value={allDay ? start.slice(0, 10) : start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>סיום</Label><Input type={allDay ? 'date' : 'datetime-local'} value={allDay ? end.slice(0, 10) : end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>מיקום</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>תזכורת</Label><Select value={reminder} onValueChange={(value) => setReminder(value ?? '30')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10 דקות לפני</SelectItem><SelectItem value="30">30 דקות לפני</SelectItem><SelectItem value="60">שעה לפני</SelectItem><SelectItem value="1440">יום לפני</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>הערות</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => void save()} disabled={saving || deleting}>{saving && <Loader2 className="size-4 animate-spin" />}{event ? 'שמור שינויים' : 'קבע פגישה'}</Button>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
          {event && <Button variant="destructive" className="mr-auto" onClick={() => void remove()} disabled={deleting}>{deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}מחק</Button>}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function WorkspaceCalendar({ clients, initialClientId, compact = false }: WorkspaceCalendarProps) {
  const [view, setView] = useState<CalendarView>(compact ? 'agenda' : 'month')
  const [cursor, setCursor] = useState(new Date())
  const [events, setEvents] = useState<WorkspaceCalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<WorkspaceCalendarEvent | null>(null)
  const [editorDate, setEditorDate] = useState<Date | null>(null)

  const range = useMemo(() => {
    if (view === 'week') return { start: startOfWeek(cursor), end: endOfWeek(cursor) }
    const monthStart = startOfMonth(cursor)
    const monthEnd = endOfMonth(cursor)
    return { start: startOfWeek(monthStart), end: endOfWeek(monthEnd) }
  }, [cursor, view])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        timeMin: range.start.toISOString(),
        timeMax: addDays(range.end, 1).toISOString(),
      })
      if (initialClientId) params.set('clientId', initialClientId)
      const response = await fetch(`/api/workspace/calendar/events?${params.toString()}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'טעינת היומן נכשלה')
      setEvents(result.events ?? [])
    } catch (loadError: unknown) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [initialClientId, range.end, range.start])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEvents(), 0)
    return () => window.clearTimeout(timer)
  }, [loadEvents])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadEvents()
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [loadEvents])

  const days = useMemo(() => eachDayOfInterval(range), [range])
  const eventsForDay = useCallback((day: Date) => events.filter((event) => isSameDay(eventDate(event.start), day)), [events])
  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients])

  function move(direction: -1 | 1) {
    setCursor((current) => view === 'week' ? addWeeks(current, direction) : addMonths(current, direction))
  }

  function openNew(day = new Date()) {
    setSelectedEvent(null)
    setEditorDate(day)
  }

  function upsertEvent(event: WorkspaceCalendarEvent) {
    setEvents((current) => [...current.filter((item) => item.id !== event.id), event].sort((a, b) => a.start.localeCompare(b.start)))
  }

  const agenda = [...events].sort((a, b) => a.start.localeCompare(b.start))

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-card shadow-sm" dir="rtl">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="flex items-center gap-1"><Button size="icon" variant="outline" onClick={() => move(1)}><ChevronRight className="size-4" /></Button><Button variant="outline" onClick={() => setCursor(new Date())}>היום</Button><Button size="icon" variant="outline" onClick={() => move(-1)}><ChevronLeft className="size-4" /></Button></div>
        <h2 className="min-w-44 text-lg font-black">{format(cursor, 'MMMM yyyy', { locale: he })}</h2>
        {!compact && <div className="flex rounded-lg border p-1">{(['month', 'week', 'agenda'] as CalendarView[]).map((item) => <Button key={item} size="sm" variant={view === item ? 'secondary' : 'ghost'} onClick={() => setView(item)}>{item === 'month' ? <CalendarDays className="size-4" /> : item === 'week' ? <Clock3 className="size-4" /> : <List className="size-4" />}{item === 'month' ? 'חודש' : item === 'week' ? 'שבוע' : 'סדר יום'}</Button>)}</div>}
        <div className="mr-auto flex gap-2"><Button size="icon" variant="ghost" onClick={() => void loadEvents()} disabled={loading}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></Button><Button onClick={() => openNew()}><Plus className="size-4" />פגישה חדשה</Button></div>
      </div>

      {error && <div className="m-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading && events.length === 0 ? <div className="grid flex-1 place-items-center"><Loader2 className="size-7 animate-spin text-indigo-500" /></div> : view === 'agenda' ? (
        <div className="flex-1 overflow-auto p-3">
          {agenda.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">אין פגישות בטווח זה</p> : agenda.map((event) => <button key={event.id} onClick={() => { setSelectedEvent(event); setEditorDate(eventDate(event.start)) }} className="mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-right hover:bg-muted"><div className="w-14 text-center"><div className="font-black">{format(eventDate(event.start), 'dd')}</div><div className="text-xs text-muted-foreground">{format(eventDate(event.start), 'MMM', { locale: he })}</div></div><div className="min-w-0 flex-1"><div className="font-bold">{event.title}</div><div className="flex gap-3 text-xs text-muted-foreground"><span>{event.allDay ? 'כל היום' : format(eventDate(event.start), 'HH:mm')}</span>{event.clientId && <span>{clientMap.get(event.clientId)}</span>}{event.location && <span className="flex items-center gap-1"><MapPin className="size-3" />{event.location}</span>}</div></div>{event.htmlLink && <a href={event.htmlLink} target="_blank" rel="noreferrer" onClick={(click) => click.stopPropagation()}><ExternalLink className="size-4 text-muted-foreground" /></a>}</button>)}
        </div>
      ) : (
        <div className={`grid flex-1 overflow-auto ${view === 'week' ? 'grid-cols-7' : 'grid-cols-7 grid-rows-6'}`}>
          {days.map((day) => <div key={day.toISOString()} onDoubleClick={() => openNew(day)} className={`min-h-28 border-b border-l p-1.5 ${!isSameMonth(day, cursor) && view === 'month' ? 'bg-muted/30 text-muted-foreground' : ''}`}><button className={`mb-1 grid size-7 place-items-center rounded-full text-xs font-bold ${isSameDay(day, new Date()) ? 'bg-indigo-600 text-white' : ''}`} onClick={() => openNew(day)}>{format(day, 'd')}</button><div className="space-y-1">{eventsForDay(day).slice(0, compact ? 2 : 4).map((event) => <button key={event.id} onClick={() => { setSelectedEvent(event); setEditorDate(day) }} className="block w-full truncate rounded-md bg-indigo-500/15 px-1.5 py-1 text-right text-[11px] font-semibold text-indigo-700 hover:bg-indigo-500/25">{event.allDay ? '' : `${format(eventDate(event.start), 'HH:mm')} `}{event.title}</button>)}</div></div>)}
        </div>
      )}

      {editorDate && <EditorDialog key={selectedEvent?.id ?? `new-${editorDate.toISOString()}`} event={selectedEvent} initialDate={editorDate} clients={clients} initialClientId={initialClientId} onClose={() => { setEditorDate(null); setSelectedEvent(null) }} onSaved={upsertEvent} onDeleted={(eventId) => setEvents((current) => current.filter((event) => event.id !== eventId))} />}
    </section>
  )
}
