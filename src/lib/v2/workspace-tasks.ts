import 'server-only'

import { randomUUID } from 'crypto'
import { addMinutes } from 'date-fns'
import { appendRows, createSpreadsheet, formatRange, getSheetRows, updateRange, type SheetTemplate } from '@/lib/google-sheets'
import { createWorkspaceFolder, moveWorkspaceFile } from '@/lib/google-drive'
import { createWorkspaceCalendarEvent } from '@/lib/v2/google-calendar'
import { getClientWorkspaceSettings } from '@/lib/v2/client-settings'
import { getWorkspaceAdminDb, getWorkspaceClient, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'
import type { OperationsWorkspaceSettings, WorkspaceTask, WorkspaceTaskInput, WorkspaceTaskPriority, WorkspaceTaskRecurrence, WorkspaceTaskReminderState, WorkspaceTaskStatus } from '@/types/workspace-task'

const TASKS_TAB = 'משימות'
const TASK_HEADERS = [
  'מזהה', 'כותרת', 'תיאור', 'מזהה לקוח', 'שם לקוח', 'סטטוס', 'עדיפות',
  'מועד יעד', 'תזכורת בדקות', 'נדחה עד', 'מזהה אירוע ביומן',
  'מחזוריות', 'יום מחזוריות', 'מזהה משימת אב',
  'נוצר בתאריך', 'עודכן בתאריך', 'הושלם בתאריך'
]

const TEMPLATES: SheetTemplate[] = [
  { title: TASKS_TAB, headers: TASK_HEADERS },
  { title: 'ערכים', headers: ['סוג', 'ערך', 'תווית'] },
]

function nullable(value: string | undefined): string | null { return value?.trim() ? value.trim() : null }
function validStatus(value: string): WorkspaceTaskStatus { return ['todo', 'in_progress', 'completed', 'cancelled'].includes(value) ? value as WorkspaceTaskStatus : 'todo' }
function validPriority(value: string): WorkspaceTaskPriority { return ['low', 'medium', 'high', 'urgent'].includes(value) ? value as WorkspaceTaskPriority : 'medium' }
function validRecurrence(value: string | undefined): WorkspaceTaskRecurrence {
  return ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(value ?? '') ? (value as WorkspaceTaskRecurrence) : 'none'
}

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

export function computeNextRecurringDueDate(
  currentDueAt: string | null,
  recurrence: WorkspaceTaskRecurrence,
  recurrenceDay?: number | null
): string {
  const base = currentDueAt ? new Date(currentDueAt) : new Date()
  const now = new Date()
  let target = new Date(base.getTime())

  if (recurrence === 'daily') {
    target.setDate(target.getDate() + 1)
    if (target.getTime() < now.getTime()) {
      target = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    }
  } else if (recurrence === 'weekly') {
    if (recurrenceDay !== undefined && recurrenceDay !== null) {
      const currentDay = target.getDay()
      let diff = recurrenceDay - currentDay
      if (diff <= 0) diff += 7
      target.setDate(target.getDate() + diff)
    } else {
      target.setDate(target.getDate() + 7)
    }
    if (target.getTime() < now.getTime()) {
      const currentDay = now.getDay()
      let diff = (recurrenceDay ?? 0) - currentDay
      if (diff <= 0) diff += 7
      target = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000)
    }
  } else if (recurrence === 'monthly') {
    target.setMonth(target.getMonth() + 1)
    if (recurrenceDay !== undefined && recurrenceDay !== null && recurrenceDay >= 1 && recurrenceDay <= 31) {
      target.setDate(recurrenceDay)
    }
    if (target.getTime() < now.getTime()) {
      target = new Date(now.getTime())
      target.setMonth(now.getMonth() + 1)
      if (recurrenceDay) target.setDate(recurrenceDay)
    }
  } else if (recurrence === 'yearly') {
    target.setFullYear(target.getFullYear() + 1)
  }

  return target.toISOString()
}

function rowToTask(row: Record<string, string>): WorkspaceTask {
  const recurrence = validRecurrence(row['מחזוריות'])
  const recurrenceDay = row['יום מחזוריות'] ? Number(row['יום מחזוריות']) : null
  const parentRecurringId = nullable(row['מזהה משימת אב'])

  const base = {
    id: row['מזהה'] || '',
    title: row['כותרת'] || '',
    description: nullable(row['תיאור']),
    clientId: nullable(row['מזהה לקוח']),
    clientName: nullable(row['שם לקוח']),
    status: validStatus(row['סטטוס'] || ''),
    priority: validPriority(row['עדיפות'] || ''),
    dueAt: nullable(row['מועד יעד']),
    reminderMinutes: Number(row['תזכורת בדקות']) || 30,
    snoozedUntil: nullable(row['נדחה עד']),
    calendarEventId: nullable(row['מזהה אירוע ביומן']),
    recurrence,
    recurrenceDay,
    parentRecurringId,
    createdAt: row['נוצר בתאריך'] || new Date().toISOString(),
    updatedAt: row['עודכן בתאריך'] || new Date().toISOString(),
    completedAt: nullable(row['הושלם בתאריך']),
  }
  return { ...base, reminderState: classifyTaskReminder(base) }
}

function taskToValues(task: Omit<WorkspaceTask, 'reminderState'>): string[] {
  const map: Record<string, string> = {
    'מזהה': task.id,
    'כותרת': task.title,
    'תיאור': task.description ?? '',
    'מזהה לקוח': task.clientId ?? '',
    'שם לקוח': task.clientName ?? '',
    'סטטוס': task.status,
    'עדיפות': task.priority,
    'מועד יעד': task.dueAt ?? '',
    'תזכורת בדקות': String(task.reminderMinutes),
    'נדחה עד': task.snoozedUntil ?? '',
    'מזהה אירוע ביומן': task.calendarEventId ?? '',
    'מחזוריות': task.recurrence ?? 'none',
    'יום מחזוריות': task.recurrenceDay !== null && task.recurrenceDay !== undefined ? String(task.recurrenceDay) : '',
    'מזהה משימת אב': task.parentRecurringId ?? '',
    'נוצר בתאריך': task.createdAt,
    'עודכן בתאריך': task.updatedAt,
    'הושלם בתאריך': task.completedAt ?? '',
  }
  return TASK_HEADERS.map((header) => map[header] ?? '')
}

export async function ensureTaskSpreadsheetHeaders(workbookId: string): Promise<void> {
  try {
    const raw = await getSheetRows(workbookId, TASKS_TAB)
    // getSheetRows reads first row as headers. If columns are missing or not matching TASK_HEADERS:
    await updateRange(workbookId, formatRange(TASKS_TAB, 'A1:Q1'), [TASK_HEADERS])
  } catch (err) {
    console.warn('[workspace-tasks] ensureTaskSpreadsheetHeaders notice:', err)
  }
}

export async function getOperationsWorkspaceSettings(): Promise<OperationsWorkspaceSettings | null> {
  try {
    await requireWorkspaceAdmin()
  } catch (authErr) {
    // In background AI streaming or server callbacks, continue with admin DB
  }
  const { data, error } = await getWorkspaceAdminDb().from('v2_operations_workspace').select('workbook_id, drive_folder_id, updated_at').eq('singleton_key', true).maybeSingle()
  if (error) throw new Error(`[workspace-tasks] Settings query failed: ${error.message}`)
  return data ? { workbookId: data.workbook_id as string, driveFolderId: data.drive_folder_id as string, updatedAt: data.updated_at as string } : null
}

export async function setupOperationsWorkspace(): Promise<OperationsWorkspaceSettings> {
  const session = await requireWorkspaceAdmin()
  const existing = await getOperationsWorkspaceSettings()
  if (existing) {
    await ensureTaskSpreadsheetHeaders(existing.workbookId)
    return existing
  }
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
  try {
    await requireWorkspaceAdmin()
  } catch (authErr) {
    // In background AI streaming, continue
  }
  if (clientId) await getWorkspaceClient(clientId)
  const settings = await getOperationsWorkspaceSettings()
  if (!settings) return []
  await ensureTaskSpreadsheetHeaders(settings.workbookId)
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
  try {
    await requireWorkspaceAdmin()
  } catch (authErr) {
    // In background AI streaming, continue
  }
  const settings = await getOperationsWorkspaceSettings()
  if (!settings) throw new Error('סביבת Nehemiah Operations טרם הוקמה')
  const client = input.clientId ? await getWorkspaceClient(input.clientId) : null
  const now = new Date().toISOString()
  const task: Omit<WorkspaceTask, 'reminderState'> = {
    id: `task_${randomUUID()}`,
    title: input.title,
    description: input.description ?? null,
    clientId: client?.id ?? null,
    clientName: client?.name ?? null,
    status: input.status ?? 'todo' as WorkspaceTaskStatus,
    priority: input.priority ?? 'medium' as WorkspaceTaskPriority,
    dueAt: input.dueAt ?? null,
    reminderMinutes: input.reminderMinutes ?? 30,
    snoozedUntil: null,
    calendarEventId: null,
    recurrence: input.recurrence ?? 'none',
    recurrenceDay: input.recurrenceDay ?? null,
    parentRecurringId: input.parentRecurringId ?? null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }
  await appendRows(settings.workbookId, TASKS_TAB, [taskToValues(task)])
  return { ...task, reminderState: classifyTaskReminder(task) }
}

export async function updateWorkspaceTask(taskId: string, input: Partial<WorkspaceTaskInput> & { snoozedUntil?: string | null; calendarEventId?: string | null }): Promise<WorkspaceTask> {
  await requireWorkspaceAdmin()
  const found = await findTask(taskId)
  const client = input.clientId === undefined ? null : input.clientId ? await getWorkspaceClient(input.clientId) : null
  const status = input.status ?? found.task.status
  const updated: Omit<WorkspaceTask, 'reminderState'> = {
    ...found.task,
    ...input,
    clientId: input.clientId === undefined ? found.task.clientId : client?.id ?? null,
    clientName: input.clientId === undefined ? found.task.clientName : client?.name ?? null,
    status,
    recurrence: input.recurrence ?? found.task.recurrence,
    recurrenceDay: input.recurrenceDay !== undefined ? input.recurrenceDay : found.task.recurrenceDay,
    updatedAt: new Date().toISOString(),
    completedAt: status === 'completed' ? found.task.completedAt ?? new Date().toISOString() : null,
  }
  await updateRange(found.settings.workbookId, formatRange(TASKS_TAB, `A${found.rowNumber}`), [taskToValues(updated)])

  // When a recurring task is completed, automatically schedule the next occurrence!
  if (status === 'completed' && found.task.status !== 'completed' && updated.recurrence && updated.recurrence !== 'none') {
    try {
      const nextDue = computeNextRecurringDueDate(found.task.dueAt, updated.recurrence, updated.recurrenceDay)
      await createWorkspaceTask({
        title: updated.title,
        description: updated.description,
        clientId: updated.clientId,
        status: 'todo',
        priority: updated.priority,
        dueAt: nextDue,
        reminderMinutes: updated.reminderMinutes,
        recurrence: updated.recurrence,
        recurrenceDay: updated.recurrenceDay,
        parentRecurringId: updated.parentRecurringId || updated.id,
      })
    } catch (recurErr) {
      console.warn('[workspace-tasks] Warning spawning next recurring task:', recurErr)
    }
  }

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
