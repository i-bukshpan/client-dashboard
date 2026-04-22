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
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from './TaskCard'
import type { Task } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface Props {
  initialTasks: Task[]
}

const COLUMNS = [
  { id: 'todo', title: 'לביצוע' },
  { id: 'in_progress', title: 'בביצוע' },
  { id: 'done', title: 'הושלם' },
]

export function KanbanBoard({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleDragEnd(event: any) {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const activeId = active.id
    const overId = over.id

    const activeTask = tasks.find((t) => t.id === activeId)
    if (!activeTask) return

    // If dropped over a column or another task
    const overTask = tasks.find((t) => t.id === overId)
    const newStatus = overTask ? overTask.status : overId as Task['status']

    if (activeTask.status !== newStatus) {
      // Update in state
      setTasks((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, status: newStatus } : t))
      )

      // Update in Supabase
      const supabase = createClient()
      await (supabase.from('tasks') as any).update({ status: newStatus }).eq('id', activeId)
    }
  }

  function handleDragStart(event: any) {
    const task = tasks.find((t) => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id as Task['status']}
            title={col.title}
            tasks={tasks.filter((t) => t.status === col.id)}
          />
        ))}

        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: { active: { opacity: '0.5' } }
          })
        }}>
          {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

