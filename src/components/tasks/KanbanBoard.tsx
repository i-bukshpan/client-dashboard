'use client'

import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { TaskCard } from './TaskCard'
import { TaskDetailSheet } from './TaskDetailSheet'
import { updateTask } from '@/app/(admin)/tasks/actions'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRouter } from 'next/navigation'
import { Archive, CheckSquare } from 'lucide-react'
import { format } from 'date-fns'

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
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

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
      await updateTask(activeId, { status: newStatus })
    }
  }

  function handleDragOver(event: any) {
    // Optional: handle visual reordering within columns
  }

  if (!mounted) return <div className="flex-1 bg-slate-50/30 animate-pulse rounded-2xl" />

  const boardTasks = tasks.filter(t => !t.archived)
  const archivedTasks = tasks.filter(t => t.archived)

  return (
    <div className="flex-1 overflow-y-auto min-h-0 pb-10 scrollbar-thin scrollbar-thumb-slate-200">
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 h-[600px] min-w-max px-1 mb-10">
          {COLUMNS.map(col => (
            <DroppableColumn 
              key={col.id} 
              col={col} 
              tasks={boardTasks.filter(t => t.status === col.id)} 
              onEdit={handleEdit} 
            />
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

      {archivedTasks.length > 0 && (
        <div className="mt-12 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Archive className="w-4 h-4 text-slate-500" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">ארכיון משימות</h3>
            <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-xs font-bold">
              {archivedTasks.length}
            </Badge>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="p-4 font-bold text-slate-700">משימה</th>
                  <th className="p-4 font-bold text-slate-700">סטטוס</th>
                  <th className="p-4 font-bold text-slate-700">לקוח</th>
                  <th className="p-4 font-bold text-slate-700">אחראי</th>
                  <th className="p-4 font-bold text-slate-700">תאריך יעד</th>
                  <th className="p-4 font-bold text-slate-700"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {archivedTasks.map(task => (
                  <tr key={task.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => handleEdit(task)}>
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{task.title}</div>
                      {task.description && <div className="text-[11px] text-slate-400 truncate max-w-xs">{task.description}</div>}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="text-[10px] font-medium border-slate-200">
                        {COLUMNS.find(c => c.id === task.status)?.label}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className="text-slate-600 font-medium">{task.clients?.name || '-'}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-slate-600 font-medium">{task.assigned_person?.full_name || '-'}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-slate-500">{task.due_date ? format(new Date(task.due_date), 'dd/MM/yyyy') : '-'}</span>
                    </td>
                    <td className="p-4">
                      <button className="text-blue-600 hover:text-blue-700 font-bold text-xs">פרטים</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

function DroppableColumn({ col, tasks, onEdit }: { col: any, tasks: any[], onEdit: (t: any) => void }) {
  const { setNodeRef } = useDroppable({
    id: col.id,
  })

  return (
    <div 
      ref={setNodeRef} 
      className="w-80 flex flex-col bg-slate-50/50 rounded-2xl border border-slate-200/50 shadow-sm"
    >
      <div className="p-4 flex items-center justify-between border-b border-slate-200/50 bg-white/50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", col.color)} />
          <h3 className="font-bold text-slate-800">{col.label}</h3>
          <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[10px] font-bold">
            {tasks.length}
          </Badge>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-3">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 pb-4 min-h-[150px]">
            {tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground/40">
                <CheckSquare className="w-8 h-8" />
                <p className="text-xs">אין משימות</p>
              </div>
            )}
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} onEdit={onEdit} />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  )
}
