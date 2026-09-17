'use client'

import React, { useState } from 'react'
import { CalendarClock, ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ClientRoutinesPanel } from '@/components/workspace/ClientRoutinesPanel'
import { WorkspaceTaskBoard } from '@/components/workspace/WorkspaceTaskBoard'
import type { ClientRoutine } from '@/lib/v2/client-ecosystem-dal'
import type { WorkspaceTask } from '@/types/workspace-task'

interface ClientOperationsCockpitProps {
  clientId: string
  clientName: string
  initialRoutines: ClientRoutine[]
  tasks: WorkspaceTask[]
}

export function ClientOperationsCockpit({
  clientId,
  clientName,
  initialRoutines,
  tasks,
}: ClientOperationsCockpitProps) {
  const [activeSubView, setActiveSubView] = useState<'routines' | 'tasks'>('routines')

  const openTasksCount = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* Sub-navigation Switcher */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/50">
          <button
            type="button"
            onClick={() => setActiveSubView('routines')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubView === 'routines'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5 text-indigo-500" />
            <span>שגרות ומחזוריות חודשית</span>
            {initialRoutines.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-indigo-100 text-indigo-700">
                {initialRoutines.length}
              </Badge>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('tasks')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubView === 'tasks'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
            <span>לוח משימות לביצוע</span>
            {openTasksCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700">
                {openTasksCount}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Active Content */}
      {activeSubView === 'routines' ? (
        <ClientRoutinesPanel
          clientId={clientId}
          clientName={clientName}
          initialRoutines={initialRoutines}
        />
      ) : (
        <div className="pt-1">
          <WorkspaceTaskBoard
            tasks={tasks}
            clients={[{ id: clientId, name: clientName }]}
            lockedClientId={clientId}
            compact
          />
        </div>
      )}
    </div>
  )
}
