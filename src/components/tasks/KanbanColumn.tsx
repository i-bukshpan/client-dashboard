'use client'

import { useSortable } from '@dnd-kit/sortable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TaskCard } from './TaskCard'
import type { Task } from '@/types/database'
import { Badge } from '@/components/ui/badge'

interface Props {
  id: Task['status']
  title: string
  tasks: Task[]
}

export function KanbanColumn({ id, title, tasks }: Props) {
  const { setNodeRef } = useSortable({
    id: id,
    data: { type: 'Column', columnId: id }
  })

  return (
    <div ref={setNodeRef} className="flex flex-col w-80 shrink-0 bg-muted/30 rounded-2xl border border-border/50 h-full">
      <div className="p-4 flex items-center justify-between">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
          {title}
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] rounded-full">{tasks.length}</Badge>
        </h3>
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <div className="h-32 border-2 border-dashed border-border/30 rounded-xl flex items-center justify-center">
            <p className="text-xs text-muted-foreground/50 italic">גרור משימה לכאן</p>
          </div>
        )}
      </div>
    </div>
  )
}



