'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CheckSquare, AlertTriangle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import type { Task } from '@/types/database'

interface UpcomingTasksProps {
  tasks: Task[]
}

const priorityConfig = {
  low: { label: 'נמוכה', color: 'bg-slate-500/20 text-slate-600 dark:text-slate-300' },
  medium: { label: 'בינונית', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300' },
  high: { label: 'גבוהה', color: 'bg-amber-500/20 text-amber-700 dark:text-amber-300' },
  urgent: { label: 'דחוף', color: 'bg-red-500/20 text-red-700 dark:text-red-300' },
}

export function UpcomingTasks({ tasks }: UpcomingTasksProps) {
  const today = new Date().toISOString().split('T')[0]

  return (
    <Card className="border-border/50 shadow-sm h-full">
      <CardHeader className="flex flex-row items-center gap-2 pb-4">
        <CheckSquare className="w-5 h-5 text-amber-500" />
        <CardTitle className="text-base">משימות פתוחות</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <CheckSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">אין משימות פתוחות</p>
          </div>
        ) : (
          tasks.map((task) => {
            const isOverdue = task.due_date && task.due_date < today
            const pcfg = priorityConfig[task.priority]
            const initials = task.profiles?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? '?'

            return (
              <Link key={task.id} href={`/admin/tasks`}>
                <div className={`rounded-xl p-3 border cursor-pointer hover:shadow-md transition-all ${isOverdue ? 'border-red-300 bg-red-50 dark:bg-red-500/10' : 'border-border/50 bg-card hover:bg-muted/30'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${isOverdue ? 'text-red-700 dark:text-red-300' : 'text-foreground'}`}>
                        {isOverdue && <AlertTriangle className="inline w-3.5 h-3.5 me-1" />}
                        {task.title}
                      </p>
                      {task.clients?.name && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.clients.name}</p>
                      )}
                    </div>
                    <Badge className={`${pcfg.color} border-0 text-xs shrink-0`}>{pcfg.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    {task.due_date && (
                      <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                        <Clock className="w-3 h-3" />
                        {format(new Date(task.due_date), 'd MMM', { locale: he })}
                      </div>
                    )}
                    {task.profiles?.full_name && (
                      <Avatar className="w-5 h-5">
                        <AvatarFallback className="text-[8px] bg-primary/20 text-primary font-bold">{initials}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                </div>
              </Link>
            )
          })
        )}

        <Link href="/admin/tasks" className="block text-center text-xs text-primary font-medium hover:underline pt-1">
          צפה בכל המשימות →
        </Link>
      </CardContent>
    </Card>
  )
}

