'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase, type Reminder, type Client } from '@/lib/supabase'
import Link from 'next/link'
import { Calendar, ChevronRight, ChevronLeft } from 'lucide-react'

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

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }
    return days
  }

  const getRemindersForDate = (date: Date | null) => {
    if (!date) return []
    const dateStr = date.toISOString().split('T')[0]
    return reminders.filter(r => r.due_date.split('T')[0] === dateStr)
  }

  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ]
  const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-grey">טוען לוח זמנים...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8" dir="rtl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy mb-2">לוח זמנים כללי</h1>
          <p className="text-grey">תצוגה מרכזית של כל המשימות והתזכורות</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigateMonth('prev')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold min-w-[200px] text-center">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <Button variant="outline" onClick={() => navigateMonth('next')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
            היום
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="p-6">
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {dayNames.map((day) => (
            <div key={day} className="text-center font-semibold text-grey p-2">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {getDaysInMonth().map((date, index) => {
            const dayReminders = getRemindersForDate(date)
            const isToday = date && date.toDateString() === new Date().toDateString()
            const isPast = date && date < new Date() && !isToday

            return (
              <div
                key={index}
                className={`min-h-[100px] border rounded p-2 ${
                  isToday ? 'bg-emerald/10 border-emerald' : isPast ? 'bg-grey/5' : 'bg-white'
                }`}
              >
                {date && (
                  <>
                    <div className={`font-semibold mb-1 ${isToday ? 'text-emerald' : ''}`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayReminders.slice(0, 3).map((reminder) => (
                        <Link
                          key={reminder.id}
                          href={reminder.client_id ? `/clients/${reminder.client_id}` : '#'}
                          className={`block text-xs p-1 rounded truncate ${
                            reminder.is_completed
                              ? 'bg-grey/20 text-grey line-through'
                              : reminder.priority === 'דחוף'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                          title={reminder.title}
                        >
                          {reminder.title}
                        </Link>
                      ))}
                      {dayReminders.length > 3 && (
                        <div className="text-xs text-grey">
                          +{dayReminders.length - 3} נוספות
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* List View */}
      <Card className="p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">רשימת תזכורות לחודש זה</h2>
        <div className="space-y-3">
          {reminders.length === 0 ? (
            <p className="text-grey text-center py-8">אין תזכורות לחודש זה</p>
          ) : (
            reminders.map((reminder) => (
              <Link
                key={reminder.id}
                href={reminder.client_id ? `/clients/${reminder.client_id}` : '#'}
                className="block p-4 border rounded-lg hover:bg-grey/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{reminder.title}</div>
                    <div className="text-sm text-grey">
                      {reminder.client ? (reminder.client as Client).name : 'כללי'} • {new Date(reminder.due_date).toLocaleDateString('he-IL')}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    reminder.priority === 'דחוף' ? 'bg-red-100 text-red-700' :
                    reminder.priority === 'רגיל' ? 'bg-blue-100 text-blue-700' :
                    'bg-grey-100 text-grey-700'
                  }`}>
                    {reminder.priority}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}

