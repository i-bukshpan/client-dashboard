import 'server-only'

import { randomUUID } from 'crypto'
import { addMinutes } from 'date-fns'
import { appendRows, createSpreadsheet, formatRange, getSheetRows, updateRange, type SheetTemplate } from '@/lib/google-sheets'
import { createWorkspaceFolder, moveWorkspaceFile } from '@/lib/google-drive'
import { createWorkspaceCalendarEvent } from '@/lib/v2/google-calendar'
import { getClientWorkspaceSettings } from '@/lib/v2/client-settings'
import { getWorkspaceAdminDb, getWorkspaceClient, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'
import type { OperationsWorkspaceSettings, WorkspaceTask, WorkspaceTaskInput, WorkspaceTaskPriority, WorkspaceTaskReminderState, WorkspaceTaskStatus } from '@/types/workspace-task'

const TASKS_TAB = 'משימות'
const TASK_HEADERS = ['מזהה', 'כותרת', 'תיאור', 'מזהה לקוח', 'שם לקוח', 'סטטוס', 'עדיפות', 'מועד יעד', 'תזכורת בדקות', 'נדחה עד', 'מזהה אירוע ביומן', 'נוצר בתאריך', 'עודכן בתאריך', 'הושלם בתאריך']
const TEMPLATES: SheetTemplate[] = [
  { title: TASKS_TAB, headers: TASK_HEADERS },
  { title: 'ערכים', headers: ['סוג', 'ערך', 'תווית'] },
]

function nullable(value: string | undefined): string | null { return value?.trim() ? value.trim() : null }
function validStatus(value: string): WorkspaceTaskStatus { return ['todo', 'in_progress', 'completed', 'cancelled'].includes(value) ? value as WorkspaceTaskStatus : 'todo' }
function validPriority(value: string): WorkspaceTaskPriority { return ['low', 'medium', 'high', 'urgent'].includes(value) ? value as WorkspaceTaskPriority : 'medium' }

export function classifyTaskReminder(task: Pick<WorkspaceTask, 'status' | 'dueAt' | 'snoozedUntil'>, now = new Date()): WorkspaceTaskReminderState {
  if (task.status === 'completed' || task.status === 'cancelled') return 'completed'
  const snoozedUntil = task.snoozedUntil ? new Date(task.snoozedUntil) : null
  if (snoozedUntil && snoozedUntil.getTime() > now.getTime()) return 'snoozed'
  if (!task.dueAt) return 'none'
  const due = new Date(task.dueAt)
  if (Number.isNaN(due.getTime())) return 'none'
  if (due.getTime() < now.getTime()) return 'overdue'
  if (due.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) === now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })) return 'due_today'
  if (due.getTime() <= now.getTime() + 72 * 60 * 60_000) return 'upcoming'
  return 'none'
}

function rowToTask(row: Record<string, string>): WorkspaceTask {
  const base = {
    id: row['מזהה'], title: row['כותרת'], description: nullable(row['תיאור']), clientId: nullable(row['מזהה לקוח']), clientName: nullable(row['שם לקוח']),
    status: validStatus(row['סטטוס']), priority: validPriority(row['עדיפות']), dueAt: nullable(row['מועד יעד']), reminderMinutes: Number(row['תזכורת בדקות']) || 30,
    snoozedUntil: nullable(row['נדחה עד']), calendarEventId: nullable(row['מזהה אירוע ביומן']), createdAt: row['נוצר בתאריך'], updatedAt: row['עודכן בתאריך'], completedAt: nullable(row['הושלם בתאריך']),
  }
  return { ...base, reminderState: classifyTaskReminder(base) }
}

function taskToValues(task: Omit<WorkspaceTask, 'reminderState'>): string[] {
  return [task.id, task.title, task.description ?? '', task.clientId ?? '', task.clientName ?? '', task.status, task.priority, task.dueAt ?? '', String(task.reminderMinutes), task.snoozedUntil ?? '', task.calendarEventId ?? '', task.createdAt, task.updatedAt, task.completedAt ?? '']
}

export async function getOperationsWorkspaceSettings(): Promise<OperationsWorkspaceSettings | null> {
  await requireWorkspaceAdmin()
  const { data, error } = await getWorkspaceAdminDb().from('v2_operations_workspace').select('workbook_id, drive_folder_id, updated_at').eq('singleton_key', true).maybeSingle()
  if (error) throw new Error(`[workspace-tasks] Settings query failed: ${error.message}`)
  return data ? { workbookId: data.workbook_id as string, driveFolderId: data.drive_folder_id as string, updatedAt: data.updated_at as string } : null
}

export async function setupOperationsWorkspace(): Promise<OperationsWorkspaceSettings> {
  const session = await requireWorkspaceAdmin()
  const existing = await getOperationsWorkspaceSettings()
  if (existing) return existing
  const folderId = await createWorkspaceFolder('Nehemiah Operations', process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID)
  const workbookId = await createSpreadsheet('Nehemiah Operations', TEMPLATES)
  await moveWorkspaceFile(workbookId, folderId)
  await appendRows(workbookId, 'ערכים', [
    ['סטטוס', 'todo', 'לביצוע'], ['סטטוס', 'in_progress', 'בטיפול'], ['סטטוס', 'completed', 'הושלם'], ['סטטוס', 'cancelled', 'בוטל'],
    ['עדיפות', 'low', 'נמוכה'], ['עדיפות', 'medium', 'בינונית'], ['עדיפות', 'high', 'גבוהה'], ['עדיפות', 'urgent', 'דחופה'],
  ])
  const { data, error } = await getWorkspaceAdminDb().from('v2_operations_workspace').upsert({ singleton_key: true, workbook_id: workbookId, drive_folder_id: folderId, created_by: session.user.id, updated_at: new Date().toISOString() }, { onConflict: 'singleton_key' }).select('workbook_id, drive_folder_id, updated_at').single()
  if (error || !data) throw new Error(error?.message ?? 'שמירת סביבת התפעול נכשלה')
  return { workbookId: data.workbook_id as string, driveFolderId: data.drive_folder_id as string, updatedAt: data.updated_at as string }
}

export async function listWorkspaceTasks(clientId?: string): Promise<WorkspaceTask[]> {
  await requireWorkspaceAdmin()
  if (clientId) await getWorkspaceClient(clientId)
  const settings = await getOperationsWorkspaceSettings()
  if (!settings) return []
  const tasks = (await getSheetRows(settings.workbookId, TASKS_TAB)).map(rowToTask)
  return tasks.filter((task) => !clientId || task.clientId === clientId).sort((a, b) => {
    const rank = { overdue: 0, due_today: 1, upcoming: 2, snoozed: 3, none: 4, completed: 5 }
    return rank[a.reminderState] - rank[b.reminderState] || (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999')
  })
}

async function findTask(taskId: string): Promise<{ settings: OperationsWorkspaceSettings; task: WorkspaceTask; rowNumber: number }> {
  const settings = await getOperationsWorkspaceSettings()
  if (!settings) throw new Error('סביבת Nehemiah Operations טרם הוקמה')
  const rows = await getSheetRows(settings.workbookId, TASKS_TAB)
  const index = rows.findIndex((row) => row['מזהה'] === taskId)
  if (index < 0) throw new Error('המשימה לא נמצאה')
  return { settings, task: rowToTask(rows[index]), rowNumber: index + 2 }
}

export async function createWorkspaceTask(input: WorkspaceTaskInput): Promise<WorkspaceTask> {
  await requireWorkspaceAdmin()
  const settings = await getOperationsWorkspaceSettings()
  if (!settings) throw new Error('סביבת Nehemiah Operations טרם הוקמה')
  const client = input.clientId ? await getWorkspaceClient(input.clientId) : null
  const now = new Date().toISOString()
  const task = { id: `task_${randomUUID()}`, title: input.title, description: input.description ?? null, clientId: client?.id ?? null, clientName: client?.name ?? null, status: input.status ?? 'todo' as WorkspaceTaskStatus, priority: input.priority ?? 'medium' as WorkspaceTaskPriority, dueAt: input.dueAt ?? null, reminderMinutes: input.reminderMinutes ?? 30, snoozedUntil: null, calendarEventId: null, createdAt: now, updatedAt: now, completedAt: null }
  await appendRows(settings.workbookId, TASKS_TAB, [taskToValues(task)])
  return { ...task, reminderState: classifyTaskReminder(task) }
}

export async function updateWorkspaceTask(taskId: string, input: Partial<WorkspaceTaskInput> & { snoozedUntil?: string | null; calendarEventId?: string | null }): Promise<WorkspaceTask> {
  await requireWorkspaceAdmin()
  const found = await findTask(taskId)
  const client = input.clientId === undefined ? null : input.clientId ? await getWorkspaceClient(input.clientId) : null
  const status = input.status ?? found.task.status
  const updated = { ...found.task, ...input, clientId: input.clientId === undefined ? found.task.clientId : client?.id ?? null, clientName: input.clientId === undefined ? found.task.clientName : client?.name ?? null, status, updatedAt: new Date().toISOString(), completedAt: status === 'completed' ? found.task.completedAt ?? new Date().toISOString() : null }
  await updateRange(found.settings.workbookId, formatRange(TASKS_TAB, `A${found.rowNumber}`), [taskToValues(updated)])
  return { ...updated, reminderState: classifyTaskReminder(updated) }
}

export async function convertWorkspaceTaskToCalendar(taskId: string): Promise<WorkspaceTask> {
  const found = await findTask(taskId)
  if (!found.task.dueAt) throw new Error('יש להגדיר מועד יעד לפני יצירת אירוע ביומן')
  if (found.task.calendarEventId) throw new Error('המשימה כבר מקושרת לאירוע ביומן')
  const client = found.task.clientId ? await getWorkspaceClient(found.task.clientId) : null
  const clientSettings = client ? await getClientWorkspaceSettings(client.id) : null
  const start = new Date(found.task.dueAt)
  const event = await createWorkspaceCalendarEvent({ title: found.task.title, description: found.task.description, start: start.toISOString(), end: addMinutes(start, 60).toISOString(), clientId: found.task.clientId, reminders: [clientSettings?.reminderDefaultMinutes ?? found.task.reminderMinutes], attendees: [] })
  return updateWorkspaceTask(taskId, { calendarEventId: event.id })
}
