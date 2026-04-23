'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { TaskCard } from './TaskCard'
import { TaskDetailSheet } from './TaskDetailSheet'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRouter } from 'next/navigation'

interface Props {
  initialTasks: any[]
  employees: any[]
}

const COLUMNS = [
  { id: 'todo', label: 'לביצוע', color: 'bg-slate-400' },
  { id: 'in_progress', label: 'בביצוע', color: 'bg-blue-500' },
  { id: 'done', label: 'הושלם', color: 'bg-emerald-500' },
]

export function KanbanBoard({ initialTasks, employees }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [activeTask, setActiveTask] = useState<any | null>(null)
  const [selectedTask, setSelectedTask] = useState<any | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const router = useRouter()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleEdit(task: any) {
    setSelectedTask(task)
    setIsDetailOpen(true)
  }

  function handleRefresh() {
    router.refresh()
  }

  function handleDragStart(event: any) {
    const task = tasks.find((t) => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  async function handleDragEnd(event: any) {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const activeId = active.id
    const overId = over.id

    const task = tasks.find((t) => t.id === activeId)
    if (!task) return

    const overTask = tasks.find((t) => t.id === overId)
    const newStatus = overTask ? overTask.status : overId

    if (task.status !== newStatus && ['todo', 'in_progress', 'done'].includes(newStatus)) {
      setTasks((prev) => prev.map((t) => (t.id === activeId ? { ...t, status: newStatus } : t)))
      const supabase = createClient()
      await (supabase.from('tasks') as any).update({ status: newStatus }).eq('id', activeId)
    }
  }

  function handleDragOver(event: any) {
    // Optional: handle visual reordering within columns
  }

  return (
    <div className="flex-1 overflow-x-auto min-h-0 pb-4 scrollbar-thin scrollbar-thumb-slate-200">
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 h-full min-w-max px-1">
          {COLUMNS.map(col => (
            <div key={col.id} className="w-80 flex flex-col bg-slate-50/50 rounded-2xl border border-slate-200/50 shadow-sm">
              <div className="p-4 flex items-center justify-between border-b border-slate-200/50 bg-white/50 rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", col.color)} />
                  <h3 className="font-bold text-slate-800">{col.label}</h3>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[10px] font-bold">
                    {tasks.filter(t => t.status === col.id).length}
                  </Badge>
                </div>
              </div>
              
              <ScrollArea className="flex-1 p-3">
                <SortableContext items={tasks.filter(t => t.status === col.id).map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3 pb-4">
                    {tasks.filter(t => t.status === col.id).map(task => (
                      <TaskCard key={task.id} task={task} onEdit={handleEdit} />
                    ))}
                  </div>
                </SortableContext>
              </ScrollArea>
            </div>
          ))}
        </div>

        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: { active: { opacity: '0.5' } }
          })
        }}>
          {activeTask ? <TaskCard task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {selectedTask && (
        <TaskDetailSheet
          task={selectedTask}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          onUpdated={handleRefresh}
          employees={employees}
        />
      )}
    </div>
  )
}
