'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { supabase, type Reminder, type Client, type MeetingLog } from '@/lib/supabase'
import Link from 'next/link'
import { Calendar, ChevronRight, ChevronLeft, Clock, CheckCircle2, MessageSquare, Plus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import { he } from 'date-fns/locale'
import { CreateMeetingDialog } from '@/components/create-meeting-dialog'

type CalendarEvent = {
  id: string
  title: string
  due_date: string
  client_id: string | null
  client?: Client | null
  eventType: 'reminder' | 'meeting'
  is_completed?: boolean
  priority?: string
}

type ViewMode = 'month' | 'week' | 'day'

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      let startDate: Date
      let endDate: Date

      if (viewMode === 'month') {
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      } else if (viewMode === 'week') {
        startDate = startOfWeek(currentDate, { weekStartsOn: 0 })
        endDate = addDays(startDate, 6)
      } else {
        startDate = new Date(currentDate)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(currentDate)
        endDate.setHours(23, 59, 59, 999)
      }

      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]

      const [remindersResult, meetingsResult] = await Promise.all([
        supabase.from('reminders').select('*, clients(id, name, parent_id)').gte('due_date', startStr).lte('due_date', endStr),
        supabase.from('meeting_logs').select('*, clients(id, name, parent_id)').gte('meeting_date', startStr).lte('meeting_date', endStr)
      ])

      // Collect parent_ids that need lookup
      const allEvents = [...(remindersResult.data || []), ...(meetingsResult.data || [])]
      const parentIds = Array.from(new Set(
        allEvents.map((e: any) => e.clients?.parent_id).filter(Boolean)
      )) as string[]
      let parentNames: Record<string, string> = {}
      if (parentIds.length > 0) {
        const { data: parents } = await supabase.from('clients').select('id, name').in('id', parentIds)
        parents?.forEach((p: any) => { parentNames[p.id] = p.name })
      }

      function buildClientLabel(clientData: any) {
        if (!clientData) return undefined
        if (clientData.parent_id && parentNames[clientData.parent_id]) {
          return `${parentNames[clientData.parent_id]} ← ${clientData.name}`
        }
        return clientData.name
      }

      const reminders: CalendarEvent[] = (remindersResult.data || []).map(r => ({
        id: r.id,
        title: r.title,
        due_date: r.due_date,
        client_id: r.client_id,
        client: r.clients ? { ...(r as any).clients, displayName: buildClientLabel((r as any).clients) } : null,
        eventType: 'reminder', is_completed: r.is_completed, priority: r.priority
      }))

      const meetings: CalendarEvent[] = (meetingsResult.data || []).map(m => ({
        id: m.id,
        title: m.subject,
        due_date: m.meeting_date,
        client_id: m.client_id,
        client: m.clients ? { ...(m as any).clients, displayName: buildClientLabel((m as any).clients) } : null,
        eventType: 'meeting'
      }))

      setEvents([...reminders, ...meetings].sort((a, b) => 
        new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      ))
    } catch (error) {
      console.error('Error loading calendar data:', error)
    } finally {
      setLoading(false)
    }
  }, [currentDate, viewMode])

  useEffect(() => { loadData() }, [loadData])

  const navigate = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const d = new Date(prev)
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1))
      } else if (viewMode === 'week') {
        d.setDate(d.getDate() + (direction === 'next' ? 7 : -7))
      } else {
        d.setDate(d.getDate() + (direction === 'next' ? 1 : -1))
      }
      return d
    })
  }, [viewMode])

  const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

  const getHeaderLabel = () => {
    if (viewMode === 'month') return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
      const weekEnd = addDays(weekStart, 6)
      return `${format(weekStart, 'd/M')} – ${format(weekEnd, 'd/M yyyy')}`
    }
    return format(currentDate, 'EEEE, d בMMMM yyyy', { locale: he })
  }

  // Month view grid
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (Date | null)[] = []
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null)
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i))
    return days
  }, [currentDate])

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const e of events) {
      const dateStr = e.due_date.split('T')[0]
      if (!map[dateStr]) map[dateStr] = []
      map[dateStr].push(e)
    }
    return map
  }, [events])

  const getEventsForDate = (date: Date | null) => {
    if (!date) return []
    return eventsByDate[date.toISOString().split('T')[0]] || []
  }

  // Week view - 7 days
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [currentDate])

  const hours = Array.from({ length: 13 }, (_, i) => i + 7) // 07:00 - 19:00

  const priorityStyles: Record<string, string> = {
    'דחוף': 'bg-red-100 text-red-700 border-red-200',
    'רגיל': 'bg-blue-100 text-blue-700 border-blue-200',
    'נמוך': 'bg-slate-100 text-slate-600 border-slate-200',
  }

  if (loading) {
    return (
      <div className="p-6 sm:p-8 animate-pulse" dir="rtl">
        <div className="h-8 w-48 bg-slate-200 rounded-lg mb-8" />
        <div className="h-[500px] bg-slate-100 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8" dir="rtl">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-black text-navy tracking-tight mb-2">יומן</h1>
          <div className="flex items-center gap-2">
            <div className="h-1 w-12 bg-primary rounded-full" />
            <p className="text-grey font-medium">פגישות, משימות ואירועים</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View mode toggle */}
          <div className="bg-white/60 border border-border/50 rounded-xl p-1 flex gap-1">
            {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                  viewMode === mode
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-grey hover:text-navy hover:bg-slate-50"
                )}
              >
                {mode === 'day' ? 'יום' : mode === 'week' ? 'שבוע' : 'חודש'}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('prev')} className="h-10 w-10 rounded-xl bg-white border border-slate-200/50">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-base font-bold min-w-[160px] text-center text-navy">
              {getHeaderLabel()}
            </span>
            <Button variant="ghost" size="icon" onClick={() => navigate('next')} className="h-10 w-10 rounded-xl bg-white border border-slate-200/50">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="rounded-xl text-xs font-bold">
              היום
            </Button>
          </div>

          {/* Create meeting */}
          <CreateMeetingDialog
            defaultDate={format(currentDate, 'yyyy-MM-dd')}
            onCreated={loadData}
          />
        </div>
      </div>

      {/* ═══ MONTH VIEW ═══ */}
      {viewMode === 'month' && (
        <div className="glass-card rounded-2xl p-4 sm:p-6 animate-fade-in-up delay-100">
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {dayNames.map(day => (
              <div key={day} className="text-center font-bold text-grey text-xs uppercase tracking-wider py-3">{day}</div>
            ))}

            {daysInMonth.map((date, index) => {
              const dayEvents = getEventsForDate(date)
              const isToday = date && isSameDay(date, new Date())
              const isPast = date && date < new Date() && !isToday

              return (
                <div
                  key={index}
                  onClick={() => { if (date) { setCurrentDate(date); setViewMode('day') } }}
                  className={cn(
                    "min-h-[100px] sm:min-h-[120px] rounded-xl p-2 transition-all duration-200 border bg-white/40 cursor-pointer hover:shadow-md",
                    !date && "bg-transparent border-transparent cursor-default",
                    date && isToday && "bg-blue-50/50 border-blue-200 ring-1 ring-blue-100",
                    date && isPast && !isToday && "opacity-60",
                    date && !isPast && !isToday && "hover:border-primary/30 hover:bg-white/60",
                  )}
                >
                  {date && (
                    <>
                      <div className={cn("text-xs font-black mb-2 flex items-center justify-between", isToday ? "text-blue-600" : "text-grey")}>
                        <span>{date.getDate()}</span>
                        {isToday && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map(event => (
                          <div
                            key={`${event.eventType}-${event.id}`}
                            className={cn(
                              "text-[10px] p-1 px-1.5 rounded-lg truncate font-bold border shadow-sm",
                              event.eventType === 'meeting'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                : event.is_completed
                                  ? 'bg-slate-50 text-grey line-through border-transparent opacity-50'
                                  : priorityStyles[event.priority || 'רגיל']
                            )}
                          >
                            <div className="flex items-center gap-1">
                              {event.eventType === 'meeting' ? <Users className="h-2.5 w-2.5 shrink-0" /> : <Clock className="h-2.5 w-2.5 shrink-0" />}
                              <span className="truncate">{event.title}</span>
                            </div>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[9px] text-grey font-bold text-center">+{dayEvents.length - 3} נוספים</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ WEEK VIEW ═══ */}
      {viewMode === 'week' && (
        <div className="glass-card rounded-2xl p-4 sm:p-6 animate-fade-in-up delay-100 overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid grid-cols-8 gap-2 mb-4">
              <div className="text-[10px] font-bold text-grey uppercase tracking-widest py-2">שעה</div>
              {weekDays.map(day => {
                const isToday = isSameDay(day, new Date())
                return (
                  <div 
                    key={day.toISOString()} 
                    onClick={() => { setCurrentDate(day); setViewMode('day') }}
                    className={cn(
                      "text-center py-2 rounded-xl cursor-pointer transition-all",
                      isToday ? "bg-blue-600 text-white" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-widest">{format(day, 'EEE', { locale: he })}</div>
                    <div className={cn("text-lg font-black", isToday ? "text-white" : "text-navy")}>{format(day, 'd')}</div>
                  </div>
                )
              })}
            </div>

            {/* Time slots */}
            {hours.map(hour => (
              <div key={hour} className="grid grid-cols-8 gap-2 border-t border-border/20">
                <div className="text-[10px] font-bold text-grey py-3 text-center">{`${hour.toString().padStart(2, '0')}:00`}</div>
                {weekDays.map(day => {
                  const dateStr = day.toISOString().split('T')[0]
                  const dayEvents = eventsByDate[dateStr] || []
                  const hourEvents = dayEvents.filter(e => {
                    const eventHour = new Date(e.due_date).getHours()
                    return eventHour === hour
                  })

                  return (
                    <div key={`${dateStr}-${hour}`} className="min-h-[48px] py-1 space-y-1">
                      {hourEvents.map(event => (
                        <Link
                          key={`${event.eventType}-${event.id}`}
                          href={event.client_id ? `/clients/${event.client_id}` : '/tasks'}
                          className={cn(
                            "block text-[10px] px-2 py-1.5 rounded-lg font-bold truncate transition-all hover:scale-[1.02]",
                            event.eventType === 'meeting'
                              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-100'
                          )}
                        >
                          {event.title}
                        </Link>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ DAY VIEW ═══ */}
      {viewMode === 'day' && (
        <div className="glass-card rounded-2xl p-4 sm:p-8 animate-fade-in-up delay-100">
          <div className="space-y-1">
            {hours.map(hour => {
              const dateStr = currentDate.toISOString().split('T')[0]
              const dayEvents = eventsByDate[dateStr] || []
              const hourEvents = dayEvents.filter(e => {
                const eventHour = new Date(e.due_date).getHours()
                return eventHour === hour
              })

              return (
                <div key={hour} className="flex gap-4 border-t border-border/20 py-2">
                  <div className="w-16 shrink-0 text-sm font-bold text-grey text-left pt-2">
                    {`${hour.toString().padStart(2, '0')}:00`}
                  </div>
                  <div className="flex-1 min-h-[50px] space-y-2 py-1">
                    {hourEvents.map(event => (
                      <Link
                        key={`${event.eventType}-${event.id}`}
                        href={event.client_id ? `/clients/${event.client_id}` : '/tasks'}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-2xl transition-all hover:shadow-md group",
                          event.eventType === 'meeting'
                            ? 'bg-indigo-50 border border-indigo-100 hover:border-indigo-300'
                            : 'bg-white border border-border/40 hover:border-primary/30'
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                          event.eventType === 'meeting' ? "bg-indigo-100 text-indigo-600" : "bg-blue-100 text-blue-600"
                        )}>
                          {event.eventType === 'meeting' ? <Users className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-navy truncate group-hover:text-primary transition-colors">{event.title}</h4>
                          <p className="text-xs font-bold text-grey">
                            {format(new Date(event.due_date), 'HH:mm')} • {event.client?.displayName || event.client?.name || '🔒 אישי'}
                          </p>
                        </div>
                        {event.eventType === 'meeting' && (
                          <span className="px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-black">פגישה</span>
                        )}
                        {event.priority === 'דחוף' && (
                          <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-[10px] font-black">דחוף</span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Unscheduled events (no specific hour) */}
            {(() => {
              const dateStr = currentDate.toISOString().split('T')[0]
              const dayEvents = eventsByDate[dateStr] || []
              const unscheduled = dayEvents.filter(e => {
                const h = new Date(e.due_date).getHours()
                return h < 7 || h > 19
              })
              if (unscheduled.length === 0) return null

              return (
                <div className="mt-6 pt-6 border-t border-border/40">
                  <h3 className="text-sm font-black text-grey uppercase tracking-widest mb-4">ללא שעה מוגדרת</h3>
                  <div className="space-y-2">
                    {unscheduled.map(event => (
                      <Link
                        key={`${event.eventType}-${event.id}`}
                        href={event.client_id ? `/clients/${event.client_id}` : '/tasks'}
                        className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-border/40 hover:border-primary/30 transition-all group"
                      >
                        <Clock className="h-4 w-4 text-grey shrink-0" />
                        <span className="font-bold text-navy text-sm group-hover:text-primary transition-colors truncate">{event.title}</span>
                        <span className="text-xs text-grey mr-auto">{event.client?.displayName || event.client?.name || 'אישי'}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Events list below calendar */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 mt-6 animate-fade-in-up delay-200">
        <div className="flex items-center gap-2 mb-5">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-black text-navy">
            {viewMode === 'day' ? 'אירועי היום' : viewMode === 'week' ? 'אירועי השבוע' : 'אירועי החודש'}
          </h2>
          <span className="text-xs font-black text-grey bg-slate-100 px-3 py-1 rounded-full">{events.length}</span>
        </div>
        <div className="space-y-2">
          {events.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-grey/30 mx-auto mb-3" />
              <p className="text-grey font-bold">אין אירועים בתקופה זו</p>
            </div>
          ) : (
            events.slice(0, 20).map(event => {
              const eventDate = new Date(event.due_date)
              const isOverdue = event.eventType === 'reminder' && !event.is_completed && eventDate < new Date()

              return (
                <Link
                  key={`list-${event.eventType}-${event.id}`}
                  href={event.client_id ? `/clients/${event.client_id}` : '/tasks'}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 group hover:shadow-md",
                    event.eventType === 'meeting' ? "bg-indigo-50/30 border-indigo-100/50" :
                    event.is_completed ? "bg-slate-50 opacity-60 border-slate-100" :
                    isOverdue ? "bg-rose-50/50 border-rose-100" : "bg-white border-border/40"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                      event.eventType === 'meeting' ? "bg-indigo-100 text-indigo-600" : "bg-blue-100 text-blue-600"
                    )}>
                      {event.eventType === 'meeting' ? <Users className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className={cn("font-bold text-navy leading-tight mb-0.5", event.is_completed && "line-through text-grey")}>
                        {event.title}
                      </div>
                      <div className="text-xs font-bold text-grey flex items-center gap-2">
                        {event.client?.displayName || event.client?.name || '🔒 אישי'} • {format(eventDate, 'd בMMMM HH:mm', { locale: he })}
                        {isOverdue && <span className="text-rose-500 font-black text-[10px] bg-rose-50 px-2 py-0.5 rounded-full">איחור</span>}
                      </div>
                    </div>
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm shrink-0",
                    event.eventType === 'meeting' ? 'bg-indigo-600 text-white border-indigo-700' : priorityStyles[event.priority || 'רגיל']
                  )}>
                    {event.eventType === 'meeting' ? 'פגישה' : event.priority}
                  </span>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
