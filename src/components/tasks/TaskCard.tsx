'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, User, User2 } from 'lucide-react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import type { Task } from '@/types/database'
import { cn } from '@/lib/utils'

interface Props {
  task: Task
  isOverlay?: boolean
}

const priorityConfig = {
  low: { label: 'נמוכה', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  medium: { label: 'בינונית', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  high: { label: 'גבוהה', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  urgent: { label: 'דחוף', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

export function TaskCard({ task, isOverlay }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'Task', task }
  })

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  }

  const pcfg = priorityConfig[task.priority]
  const initials = task.profiles?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? '?'

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab active:cursor-grabbing border-border/50 shadow-sm hover:border-primary/30 transition-all group",
        isDragging && "opacity-30",
        isOverlay && "cursor-grabbing shadow-2xl border-primary ring-2 ring-primary/20 scale-105"
      )}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Badge className={cn("text-[10px] px-1.5 h-5 border-0", pcfg.color)}>
            {pcfg.label}
          </Badge>
          {task.clients?.name && (
            <Badge variant="outline" className="text-[10px] px-1.5 h-5 truncate max-w-[100px] border-primary/20 text-primary">
              {task.clients.name}
            </Badge>
          )}
        </div>

        <p className="text-sm font-bold leading-snug group-hover:text-primary transition-colors">
          {task.title}
        </p>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <Avatar className="w-5 h-5 border border-background">
              <AvatarImage src={task.profiles?.avatar_url ?? undefined} />
              <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-black">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-[10px] text-muted-foreground truncate max-w-[70px]">
              {task.profiles?.full_name?.split(' ')[0]}
            </span>
          </div>

          {task.due_date && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {format(new Date(task.due_date), 'd MMM', { locale: he })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}


