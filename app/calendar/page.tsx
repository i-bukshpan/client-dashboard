'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { supabase, type Reminder, type Client } from '@/lib/supabase'
import Link from 'next/link'
import { Calendar, ChevronRight, ChevronLeft, Clock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CalendarPage() {
  const [reminders, setReminders] = useState<Array<Reminder & { client?: Client }>>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    loadReminders()
  }, [currentDate])

  const loadReminders = async () => {
    setLoading(true)
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      const { data: remindersData, error } = await supabase
        .from('reminders')
        .select('*, clients(*)')
        .gte('due_date', startOfMonth.toISOString().split('T')[0])
        .lte('due_date', endOfMonth.toISOString().split('T')[0])
        .order('due_date', { ascending: true })

      if (error) throw error

      setReminders((remindersData || []) as Array<Reminder & { client?: Client }>)
    } catch (error) {
      console.error('Error loading reminders:', error)
    } finally {
      setLoading(false)
    }
  }

  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }, [])

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const numDays = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: (Date | null)[] = []
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    for (let i = 1; i <= numDays; i++) {
      days.push(new Date(year, month, i))
    }
    return days
  }, [currentDate])

  const remindersByDate = useMemo(() => {
    const map: Record<string, Array<Reminder & { client?: Client }>> = {}
    for (const r of reminders) {
      const dateStr = r.due_date.split('T')[0]
      if (!map[dateStr]) map[dateStr] = []
      map[dateStr].push(r)
    }
    return map
  }, [reminders])

  const getRemindersForDate = useCallback((date: Date | null) => {
    if (!date) return []
    const dateStr = date.toISOString().split('T')[0]
    return remindersByDate[dateStr] || []
  }, [remindersByDate])

  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ]
  const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

  const priorityStyles: Record<string, string> = {
    'דחוף': 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
    'רגיל': 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    'נמוך': 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600/30',
  }

  if (loading) {
    return (
      <div className="p-6 sm:p-8">
        <div className="mb-8 animate-pulse">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="glass-card rounded-2xl p-6">
          <div className="grid grid-cols-7 gap-2">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="h-24 shimmer rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8" dir="rtl">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-extrabold text-navy tracking-tight mb-2">לוח זמנים</h1>
          <div className="flex items-center gap-2">
            <div className="h-1 w-12 bg-primary rounded-full" />
            <p className="text-grey font-medium">תצוגה מרכזית של כל המשימות והתזכורות</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateMonth('prev')}
            className="h-10 w-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-base font-bold min-w-[160px] text-center text-navy">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateMonth('next')}
            className="h-10 w-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
            className="rounded-xl text-xs font-bold"
          >
            היום
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 animate-fade-in-up delay-100">
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Day headers */}
          {dayNames.map((day) => (
            <div key={day} className="text-center font-bold text-grey text-xs uppercase tracking-wider py-3">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {daysInMonth.map((date, index) => {
            const dayReminders = getRemindersForDate(date)
            const isToday = date && date.toDateString() === new Date().toDateString()
            const isPast = date && date < new Date() && !isToday
            const hasReminders = dayReminders.length > 0
            const hasUrgent = dayReminders.some(r => r.priority === 'דחוף' && !r.is_completed)

            return (
              <div
                key={index}
                className={cn(
                  "min-h-[90px] sm:min-h-[110px] rounded-xl p-2 transition-all duration-200 border",
                  !date && "bg-transparent border-transparent",
                  date && isToday && "bg-primary/5 dark:bg-primary/10 border-primary/30 ring-1 ring-primary/20",
                  date && isPast && !isToday && "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/30 dark:border-slate-700/20",
                  date && !isPast && !isToday && "bg-white dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/30 hover:border-primary/30 hover:bg-primary/[0.02]",
                  hasUrgent && !isToday && "border-red-200 dark:border-red-500/20"
                )}
              >
                {date && (
                  <>
                    <div className={cn(
                      "text-sm font-bold mb-1.5 flex items-center gap-1",
                      isToday && "text-primary",
                      isPast && !isToday && "text-grey",
                      !isPast && !isToday && "text-navy"
                    )}>
                      {isToday && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayReminders.slice(0, 2).map((reminder) => (
                        <Link
                          key={reminder.id}
                          href={reminder.client_id ? `/clients/${reminder.client_id}` : '#'}
                          className={cn(
                            "block text-[10px] sm:text-xs p-1 px-1.5 rounded-lg truncate font-medium transition-all hover:opacity-80 border",
                            reminder.is_completed
                              ? 'bg-slate-100 dark:bg-slate-700/30 text-grey line-through border-transparent'
                              : priorityStyles[reminder.priority] || priorityStyles['רגיל']
                          )}
                          title={reminder.title}
                        >
                          {reminder.title}
                        </Link>
                      ))}
                      {dayReminders.length > 2 && (
                        <div className="text-[10px] text-grey font-medium px-1">
                          +{dayReminders.length - 2} נוספות
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* List View */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 mt-6 animate-fade-in-up delay-200">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-navy">רשימת תזכורות לחודש זה</h2>
          <span className="text-xs font-bold text-grey bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{reminders.length}</span>
        </div>
        <div className="space-y-2">
          {reminders.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-grey/30 mx-auto mb-3" />
              <p className="text-grey font-medium">אין תזכורות לחודש זה</p>
            </div>
          ) : (
            reminders.map((reminder) => {
              const isOverdue = !reminder.is_completed && new Date(reminder.due_date) < new Date()
              return (
                <Link
                  key={reminder.id}
                  href={reminder.client_id ? `/clients/${reminder.client_id}` : '#'}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 group",
                    "hover:shadow-sm hover:-translate-y-0.5",
                    reminder.is_completed
                      ? "bg-slate-50/50 dark:bg-slate-800/20 border-slate-200/30 dark:border-slate-700/20"
                      : isOverdue
                        ? "bg-red-50/50 dark:bg-red-500/5 border-red-200/50 dark:border-red-500/15"
                        : "bg-white dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-700/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {reminder.is_completed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    ) : (
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        reminder.priority === 'דחוף' ? "bg-red-500" : "bg-blue-500"
                      )} />
                    )}
                    <div>
                      <div className={cn(
                        "font-semibold text-sm",
                        reminder.is_completed && "line-through text-grey"
                      )}>
                        {reminder.title}
                      </div>
                      <div className="text-xs text-grey mt-0.5">
                        {reminder.client ? (reminder.client as Client).name : 'כללי'} • {new Date(reminder.due_date).toLocaleDateString('he-IL')}
                        {isOverdue && <span className="text-red-500 font-bold mr-1"> (איחור)</span>}
                      </div>
                    </div>
                  </div>
                  <span className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-bold border shrink-0",
                    priorityStyles[reminder.priority] || priorityStyles['רגיל']
                  )}>
                    {reminder.priority}
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
