'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { clientWorkspaceSettingsSchema, workspaceTaskInputSchema, workspaceTaskUpdateSchema } from '@/lib/v2/task-schema'
import { saveClientWorkspaceSettings } from '@/lib/v2/client-settings'
import { convertWorkspaceTaskToCalendar, createWorkspaceTask, setupOperationsWorkspace, updateWorkspaceTask } from '@/lib/v2/workspace-tasks'
import { requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

function failure(error: unknown, fallback: string) { return { error: error instanceof Error ? error.message : fallback } }
function refresh(clientId?: string | null) { revalidatePath('/workspace/tasks'); if (clientId) revalidatePath(`/workspace/clients/${clientId}`) }

export async function setupOperationsWorkspaceAction() {
  try { await requireWorkspaceAdmin(); const settings = await setupOperationsWorkspace(); revalidatePath('/workspace/tasks'); return { success: true as const, settings } }
  catch (error: unknown) { return failure(error, 'הקמת סביבת המשימות נכשלה') }
}

export async function createWorkspaceTaskAction(raw: unknown) {
  try { await requireWorkspaceAdmin(); const input = workspaceTaskInputSchema.parse(raw); const task = await createWorkspaceTask(input); refresh(task.clientId); return { success: true as const, task } }
  catch (error: unknown) { return failure(error, 'יצירת המשימה נכשלה') }
}

export async function updateWorkspaceTaskAction(taskId: string, raw: unknown) {
  try { await requireWorkspaceAdmin(); const id = z.string().min(8).max(100).parse(taskId); const input = workspaceTaskUpdateSchema.parse(raw); const task = await updateWorkspaceTask(id, input); refresh(task.clientId); return { success: true as const, task } }
  catch (error: unknown) { return failure(error, 'עדכון המשימה נכשל') }
}

export async function completeWorkspaceTaskAction(taskId: string) { return updateWorkspaceTaskAction(taskId, { status: 'completed' }) }

export async function snoozeWorkspaceTaskAction(taskId: string, snoozedUntil: string) { return updateWorkspaceTaskAction(taskId, { snoozedUntil }) }

export async function convertTaskToCalendarAction(taskId: string) {
  try { await requireWorkspaceAdmin(); const id = z.string().min(8).max(100).parse(taskId); const task = await convertWorkspaceTaskToCalendar(id); refresh(task.clientId); revalidatePath('/workspace/calendar'); return { success: true as const, task } }
  catch (error: unknown) { return failure(error, 'המרת המשימה לאירוע נכשלה') }
}

export async function deleteWorkspaceTaskAction(taskId: string) {
  try {
    await requireWorkspaceAdmin()
    const id = z.string().min(8).max(100).parse(taskId)
    const { deleteWorkspaceTask } = await import('@/lib/v2/workspace-tasks')
    const res = await deleteWorkspaceTask(id)
    refresh()
    return { success: true as const, ...res }
  } catch (error: unknown) {
    return failure(error, 'מחיקת המשימה נכשלה')
  }
}

export async function saveClientWorkspaceSettingsAction(raw: unknown) {
  try {
    await requireWorkspaceAdmin()
    const input = clientWorkspaceSettingsSchema.parse(raw)
    const settings = await saveClientWorkspaceSettings(input)
    revalidatePath(`/workspace/clients/${settings.clientId}`)
    return { success: true as const, settings }
  } catch (error: unknown) {
    return failure(error, 'שמירת הגדרות הלקוח נכשלה')
  }
}
