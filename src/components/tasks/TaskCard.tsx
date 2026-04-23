'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, Users } from 'lucide-react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import type { Task } from '@/types/database'
import { cn } from '@/lib/utils'

interface TaskCardProps {
  task: any
  onEdit?: (task: any) => void
}

const priorityMap = {
  low: { label: 'נמוכה', class: 'bg-slate-100 text-slate-600' },
  medium: { label: 'בינונית', class: 'bg-blue-100 text-blue-700' },
  high: { label: 'גבוהה', class: 'bg-amber-100 text-amber-700' },
  urgent: { label: 'דחוף', class: 'bg-red-100 text-red-700' },
}

export function TaskCard({ task, onEdit }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id,
    data: { task }
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: isDragging ? 'grabbing' : 'pointer'
  }

  const initials = task.assigned_person?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        "group border-border/50 hover:border-primary/40 transition-all duration-200 shadow-sm hover:shadow-md select-none",
        isDragging && "ring-2 ring-primary"
      )}
      onClick={() => onEdit?.(task)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Badge className={cn("text-[10px] px-1.5 py-0 rounded-md shadow-sm", priorityMap[task.priority as keyof typeof priorityMap].class)}>
            {priorityMap[task.priority as keyof typeof priorityMap].label}
          </Badge>
          {task.assigned_person && (
            <Avatar className="w-6 h-6 border-2 border-white shadow-sm shrink-0">
              <AvatarImage src={task.assigned_person.avatar_url} />
              <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        
        <div>
          <h4 className="font-bold text-sm text-slate-900 group-hover:text-primary transition-colors leading-snug">{task.title}</h4>
          {task.description && (
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span className="text-[10px] font-medium">
              {task.due_date ? format(new Date(task.due_date), 'dd/MM/yy') : 'ללא תאריך'}
            </span>
          </div>
          {task.clients && (
            <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              <Users className="w-3 h-3" />
              <span className="text-[10px] font-bold truncate max-w-[80px]">{task.clients.name}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}



