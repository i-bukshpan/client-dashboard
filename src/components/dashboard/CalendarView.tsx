'use client'

import { useState } from 'react'
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval 
} from 'date-fns'
import { he } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CheckSquare, TrendingUp, TrendingDown, Calendar as CalendarIcon, Clock, User as UserIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CalendarAppointmentDialog } from './CalendarAppointmentDialog'

interface Props {
  tasks: any[]
  income: any[]
  expenses: any[]
  appointments: any[]
  clients: any[]
  profiles: any[]
}

export function CalendarView({ tasks, income, expenses, appointments, clients, profiles }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  })

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))

  const getDayData = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return {
      tasks: tasks.filter(t => t.due_date === dateStr),
      income: income.filter(i => i.date === dateStr),
      expenses: expenses.filter(e => e.date === dateStr),
      appts: appointments.filter(a => a.start_time?.split('T')[0] === dateStr)
    }
  }

  const selectedDayData = selectedDay ? getDayData(selectedDay) : null

  return (
    <>
      <Card className="border-border/50 shadow-lg overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/20 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-xl font-bold">
              {format(currentDate, 'MMMM yyyy', { locale: he })}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 hover:bg-white rounded-lg transition-colors border border-border/50 shadow-sm">
              <ChevronRight className="w-5 h-5" />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-sm font-medium hover:bg-white rounded-lg transition-colors border border-border/50 shadow-sm">
              היום
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-white rounded-lg transition-colors border border-border/50 shadow-sm">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b border-border/50 bg-muted/5">
            {['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''].map((day) => (
              <div key={day} className="py-2 text-center text-xs font-bold text-muted-foreground border-r border-border/50 last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const { tasks: dayTasks, income: dayIncome, expenses: dayExpenses, appts: dayAppts } = getDayData(day)
              const isCurrentMonth = isSameMonth(day, monthStart)
              const isToday = isSameDay(day, new Date())

              return (
                <div 
                  key={idx} 
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "min-h-[120px] p-2 border-r border-b border-border/50 last:border-r-0 transition-colors hover:bg-slate-50/50 group cursor-pointer",
                    !isCurrentMonth && "bg-muted/5 opacity-40"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                      isToday ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500"
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {dayAppts.length > 0 && (
                      <div className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 truncate font-medium">
                        🕒 {dayAppts.length} פגישות
                      </div>
                    )}
                    {dayTasks.length > 0 && (
                      <div className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 truncate font-medium">
                        📝 {dayTasks.length} משימות
                      </div>
                    )}
                    {dayIncome.length > 0 && (
                      <div className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 truncate font-bold">
                        📈 ₪{dayIncome.reduce((s, x) => s + Number(x.amount), 0).toLocaleString()}
                      </div>
                    )}
                    {dayExpenses.length > 0 && (
                      <div className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 truncate font-bold">
                        📉 ₪{dayExpenses.reduce((s, x) => s + Number(x.amount), 0).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              פירוט ליום {selectedDay && format(selectedDay, 'd MMMM yyyy', { locale: he })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Appointments Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="text-sm font-bold flex items-center gap-2 text-blue-600">
                  <Clock className="w-4 h-4" />
                  פגישות ({selectedDayData?.appts.length || 0})
                </h4>
                <CalendarAppointmentDialog 
                  clients={clients} 
                  profiles={profiles} 
                  initialDate={selectedDay ?? undefined}
                  onSuccess={() => setSelectedDay(null)}
                />
              </div>
              {selectedDayData?.appts.length ? (
                <div className="space-y-2">
                  {selectedDayData.appts.map((a, i) => (
                    <div key={i} className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-sm text-blue-900">{a.clients?.name || 'פגישה ללא שם'}</span>
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">
                          {format(new Date(a.start_time), 'HH:mm')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-blue-600">
                        <UserIcon className="w-3 h-3" />
                        {a.profiles?.full_name || 'לא שויך עובד'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">אין פגישות מתוכננות ליום זה</p>
              )}
            </div>

            {/* Tasks Section */}
            {selectedDayData?.tasks.length ? (
              <div className="space-y-3">
                <h4 className="text-sm font-bold flex items-center gap-2 text-amber-600">
                  <CheckSquare className="w-4 h-4" />
                  משימות לביצוע ({selectedDayData.tasks.length})
                </h4>
                <div className="space-y-2">
                  {selectedDayData.tasks.map((t, i) => (
                    <div key={i} className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                      <div className="font-bold text-sm text-amber-900 mb-1">{t.title}</div>
                      <div className="flex items-center justify-between text-xs text-amber-600">
                        <span>לקוח: {t.clients?.name || 'ללא'}</span>
                        <Badge variant="outline" className="text-[10px] border-amber-200">{t.priority}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Finance Section */}
            {(selectedDayData?.income.length || selectedDayData?.expenses.length) ? (
              <div className="space-y-3">
                <h4 className="text-sm font-bold flex items-center gap-2 text-slate-900 border-b pb-2">
                  <TrendingUp className="w-4 h-4" />
                  תנועות כספיות
                </h4>
                <div className="space-y-2">
                  {selectedDayData?.income.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                      <div className="text-xs">
                        <div className="font-bold text-emerald-900">{item.category}</div>
                        <div className="text-emerald-600">{item.clients?.name || 'הכנסה כללית'}</div>
                      </div>
                      <div className="font-black text-emerald-700">+₪{Number(item.amount).toLocaleString()}</div>
                    </div>
                  ))}
                  {selectedDayData?.expenses.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100">
                      <div className="text-xs">
                        <div className="font-bold text-red-900">{item.category}</div>
                        <div className="text-red-600">{item.notes || 'הוצאה'}</div>
                      </div>
                      <div className="font-black text-red-700">-₪{Number(item.amount).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {(!selectedDayData?.appts.length && !selectedDayData?.tasks.length && !selectedDayData?.income.length && !selectedDayData?.expenses.length) && (
              <div className="text-center py-12 text-slate-400 italic text-sm">
                אין אירועים רשומים ליום זה
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
