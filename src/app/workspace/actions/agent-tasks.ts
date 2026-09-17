'use server'

/**
 * src/app/workspace/actions/agent-tasks.ts
 *
 * Server Actions for Nehemiah OS Autonomous Agent Scheduled Tasks.
 */

import { revalidatePath } from 'next/cache'
import {
  listAgentScheduledTasks,
  createAgentScheduledTask,
  updateAgentScheduledTask,
  deleteAgentScheduledTask,
  toggleAgentScheduledTask,
  executeAgentScheduledTask,
  type CreateAgentScheduledTaskInput,
  type AgentScheduledTask,
} from '@/lib/v2/agent-scheduler'

export async function getAgentTasksAction(options?: {
  clientId?: string
  statusFilter?: 'all' | 'active' | 'paused'
}): Promise<AgentScheduledTask[]> {
  try {
    return await listAgentScheduledTasks(options)
  } catch (error: any) {
    console.error('[agent-tasks] getAgentTasksAction error:', error)
    return []
  }
}

export async function createAgentTaskAction(input: CreateAgentScheduledTaskInput) {
  try {
    const task = await createAgentScheduledTask(input)
    revalidatePath('/workspace/notebook')
    return { success: true, task }
  } catch (error: any) {
    console.error('[agent-tasks] createAgentTaskAction error:', error)
    return { success: false, error: error.message || 'שגיאה ביצירת משימת סוכן' }
  }
}

export async function updateAgentTaskAction(
  id: string,
  updates: Partial<CreateAgentScheduledTaskInput> & { is_active?: boolean }
) {
  try {
    const task = await updateAgentScheduledTask(id, updates)
    revalidatePath('/workspace/notebook')
    return { success: true, task }
  } catch (error: any) {
    console.error('[agent-tasks] updateAgentTaskAction error:', error)
    return { success: false, error: error.message || 'שגיאה בעדכון משימת סוכן' }
  }
}

export async function deleteAgentTaskAction(id: string) {
  try {
    await deleteAgentScheduledTask(id)
    revalidatePath('/workspace/notebook')
    return { success: true }
  } catch (error: any) {
    console.error('[agent-tasks] deleteAgentTaskAction error:', error)
    return { success: false, error: error.message || 'שגיאה במחיקת משימת סוכן' }
  }
}

export async function toggleAgentTaskAction(id: string, isActive: boolean) {
  try {
    const task = await toggleAgentScheduledTask(id, isActive)
    revalidatePath('/workspace/notebook')
    return { success: true, task }
  } catch (error: any) {
    console.error('[agent-tasks] toggleAgentTaskAction error:', error)
    return { success: false, error: error.message || 'שגיאה בשינוי סטטוס משימת סוכן' }
  }
}

export async function runAgentTaskNowAction(task: AgentScheduledTask) {
  try {
    const outcome = await executeAgentScheduledTask(task)
    revalidatePath('/workspace/notebook')
    return { success: outcome.success, summary: outcome.summary, error: outcome.error }
  } catch (error: any) {
    console.error('[agent-tasks] runAgentTaskNowAction error:', error)
    return { success: false, error: error.message || 'שגיאה בהפעלת משימת סוכן' }
  }
}
