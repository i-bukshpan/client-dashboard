'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CalendarDays, DollarSign, CheckSquare, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import type { Appointment, Income, Task } from '@/types/database'

interface Props {
  appointments: Appointment[]
  income: Income[]
  tasks: Task[]
}

const statusConfig = {
  scheduled: { label: 'מתוכנן', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300', icon: Clock },
  done: { label: 'הסתיים', color: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  cancelled: { label: 'בוטל', color: 'bg-red-500/20 text-red-700 dark:text-red-300', icon: XCircle },
}

const taskStatusConfig = {
  todo: { label: 'לביצוע', color: 'bg-slate-500/20 text-slate-600' },
  in_progress: { label: 'בביצוע', color: 'bg-amber-500/20 text-amber-700' },
  done: { label: 'בוצע', color: 'bg-emerald-500/20 text-emerald-700' },
}

export function ClientHistory({ appointments, income, tasks }: Props) {
  return (
    <div className="space-y-6">
      {/* Financial History */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border/50 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold">היסטוריית תשלומים</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תאריך</TableHead>
                <TableHead>קטגוריה</TableHead>
                <TableHead>הערות</TableHead>
                <TableHead className="text-left">סכום</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {income.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">אין תשלומים רשומים</TableCell>
                </TableRow>
              ) : (
                income.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{format(new Date(row.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.category}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={row.notes ?? ''}>{row.notes}</TableCell>
                    <TableCell className="text-left font-bold text-emerald-600">
                      ₪{Number(row.amount).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Appointments */}
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="p-4 border-b border-border/50 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold">פגישות עבר ועתיד</h3>
            </div>
            <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
              {appointments.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">אין פגישות רשומות</p>
              ) : (
                appointments.map((appt) => {
                  const cfg = statusConfig[appt.status]
                  const Icon = cfg.icon
                  return (
                    <div key={appt.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="font-semibold text-sm">{appt.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(appt.start_time), 'dd/MM/yyyy HH:mm', { locale: he })}
                        </p>
                      </div>
                      <Badge className={`${cfg.color} text-[10px] gap-1 border-0`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </Badge>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="p-4 border-b border-border/50 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold">משימות פתוחות וסגורות</h3>
            </div>
            <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
              {tasks.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">אין משימות רשומות</p>
              ) : (
                tasks.map((task) => {
                  const cfg = taskStatusConfig[task.status]
                  return (
                    <div key={task.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0 me-4">
                        <p className="font-semibold text-sm truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] px-1 h-4">{task.priority}</Badge>
                          {task.due_date && (
                            <p className="text-[10px] text-muted-foreground">
                              יעד: {format(new Date(task.due_date), 'dd/MM/yy')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge className={`${cfg.color} text-[10px] border-0`}>
                        {cfg.label}
                      </Badge>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

