export type WorkspaceTaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled'
export type WorkspaceTaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type WorkspaceTaskReminderState = 'overdue' | 'due_today' | 'upcoming' | 'snoozed' | 'none' | 'completed'

export interface WorkspaceTask {
  id: string
  title: string
  description: string | null
  clientId: string | null
  clientName: string | null
  status: WorkspaceTaskStatus
  priority: WorkspaceTaskPriority
  dueAt: string | null
  reminderMinutes: number
  snoozedUntil: string | null
  calendarEventId: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  reminderState: WorkspaceTaskReminderState
}

export interface WorkspaceTaskInput {
  title: string
  description?: string | null
  clientId?: string | null
  status?: WorkspaceTaskStatus
  priority?: WorkspaceTaskPriority
  dueAt?: string | null
  reminderMinutes?: number
}

export interface OperationsWorkspaceSettings {
  workbookId: string
  driveFolderId: string
  updatedAt: string
}

export interface ClientWorkspaceSettings {
  clientId: string
  reminderDefaultMinutes: number
  monthlyBriefEnabled: boolean
  monthlyBriefDay: number
  monthlyBriefIncludeTasks: boolean
  monthlyBriefIncludeCalendar: boolean
  alerts: {
    overdueTasks: boolean
    upcomingTasks: boolean
    missingDocuments: boolean
    cashFlow: boolean
  }
}
