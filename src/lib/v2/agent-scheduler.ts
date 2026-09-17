import 'server-only'

/**
 * src/lib/v2/agent-scheduler.ts
 *
 * Autonomous Agent Scheduled Tasks & Routines Engine for Nehemiah OS.
 * Manages recurring or one-off tasks assigned to the AI agent:
 * - Morning email digests and client thread monitoring
 * - Daily calendar scans & agenda reminders
 * - Automated payment/invoice reminder emails
 * - Client file & Google Sheets periodic audits
 * - Custom scheduled prompts
 */

import { CronExpressionParser } from 'cron-parser'
import { generateText, stepCountIs } from 'ai'
import { google } from '@ai-sdk/google'
import {
  getWorkspaceAdminDb,
  requireWorkspaceAdmin,
  listWorkspaceClients,
  findWorkspaceClientByNameOrId,
} from '@/lib/v2/workspace-dal'
import { saveNotebookArtifact } from '@/lib/v2/notebook-artifacts'
import { createGlobalAgentTools } from '@/ai/tools/global-agent-tools'

export type AgentTaskScheduleType = 'daily' | 'once' | 'weekly' | 'cron'
export type AgentTaskType = 'check_emails' | 'scan_calendar' | 'send_email' | 'audit_client' | 'custom_prompt'
export type AgentTaskRunStatus = 'success' | 'failed' | 'running' | null

export interface AgentScheduledTask {
  id: string
  user_id: string
  title: string
  instruction: string
  task_type: AgentTaskType
  schedule_type: AgentTaskScheduleType
  scheduled_time: string | null
  cron_expression: string | null
  timezone: string
  client_id: string | null
  is_active: boolean
  last_run_at: string | null
  last_run_status: AgentTaskRunStatus
  last_run_result: Record<string, any>
  next_run_at: string
  created_at: string
  updated_at: string
  client_name?: string
}

export interface CreateAgentScheduledTaskInput {
  title: string
  instruction: string
  taskType?: AgentTaskType
  scheduleType: AgentTaskScheduleType
  scheduledTime?: string // e.g. "08:30" or ISO string
  cronExpression?: string
  clientId?: string | null
  clientIdOrName?: string
}

/**
 * Computes the next occurrence timestamp in Asia/Jerusalem timezone.
 */
export function calculateNextRun(
  scheduleType: AgentTaskScheduleType,
  scheduledTime?: string | null,
  cronExpression?: string | null,
  fromDate: Date = new Date()
): Date {
  const tz = 'Asia/Jerusalem'

  if (scheduleType === 'cron' && cronExpression) {
    try {
      const interval = CronExpressionParser.parse(cronExpression, {
        currentDate: fromDate,
        tz,
      })
      return interval.next().toDate()
    } catch {
      // Fallback +24h
      return new Date(fromDate.getTime() + 24 * 60 * 60 * 1000)
    }
  }

  if (scheduleType === 'daily') {
    // Default to 08:30 if not specified
    const timeParts = (scheduledTime || '08:30').split(':')
    const targetHour = parseInt(timeParts[0] || '8', 10)
    const targetMin = parseInt(timeParts[1] || '30', 10)

    // Formatter to inspect current Israel date
    const israelFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    const parts = israelFormatter.formatToParts(fromDate)
    const year = parseInt(parts.find((p) => p.type === 'year')?.value || '2026', 10)
    const month = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10) - 1
    const day = parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10)
    const curHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10)
    const curMin = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10)

    const targetToday = new Date(Date.UTC(year, month, day, targetHour - 3, targetMin, 0)) // roughly UTC offset for Israel (IST/IDT)
    const hasPassed = curHour > targetHour || (curHour === targetHour && curMin >= targetMin)

    if (hasPassed) {
      // Schedule for tomorrow
      return new Date(Date.now() + 24 * 60 * 60 * 1000)
    } else {
      // Schedule for today
      return new Date(Date.now() + Math.max(1, (targetHour - curHour) * 60 + (targetMin - curMin)) * 60 * 1000)
    }
  }

  if (scheduleType === 'weekly') {
    return new Date(fromDate.getTime() + 7 * 24 * 60 * 60 * 1000)
  }

  // scheduleType === 'once'
  if (scheduledTime) {
    const parsed = new Date(scheduledTime)
    if (!isNaN(parsed.getTime())) return parsed
  }
  return new Date(fromDate.getTime() + 60 * 60 * 1000)
}

/**
 * Lists all agent scheduled tasks with client names joined
 */
export async function listAgentScheduledTasks(options?: {
  clientId?: string
  statusFilter?: 'all' | 'active' | 'paused'
}): Promise<AgentScheduledTask[]> {
  const db = getWorkspaceAdminDb()
  let query = db
    .from('v2_agent_scheduled_tasks')
    .select('*, client:clients(id, name)')
    .order('next_run_at', { ascending: true })

  if (options?.clientId) {
    query = query.eq('client_id', options.clientId)
  }
  if (options?.statusFilter === 'active') {
    query = query.eq('is_active', true)
  } else if (options?.statusFilter === 'paused') {
    query = query.eq('is_active', false)
  }

  const { data, error } = await query
  if (error) {
    console.error('[agent-scheduler] list tasks error:', error)
    return []
  }

  return (data || []).map((t: any) => ({
    id: t.id,
    user_id: t.user_id,
    title: t.title,
    instruction: t.instruction,
    task_type: t.task_type,
    schedule_type: t.schedule_type,
    scheduled_time: t.scheduled_time,
    cron_expression: t.cron_expression,
    timezone: t.timezone || 'Asia/Jerusalem',
    client_id: t.client_id,
    is_active: t.is_active,
    last_run_at: t.last_run_at,
    last_run_status: t.last_run_status,
    last_run_result: t.last_run_result || {},
    next_run_at: t.next_run_at,
    created_at: t.created_at,
    updated_at: t.updated_at,
    client_name: t.client?.name || undefined,
  }))
}

/**
 * Creates a new scheduled task for the AI agent
 */
export async function createAgentScheduledTask(
  input: CreateAgentScheduledTaskInput
): Promise<AgentScheduledTask> {
  const session = await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()

  let clientId = input.clientId || null
  if (!clientId && input.clientIdOrName) {
    const clients = await listWorkspaceClients()
    const target = findWorkspaceClientByNameOrId(clients, input.clientIdOrName)
    if (target) clientId = target.id
  }

  const nextRun = calculateNextRun(input.scheduleType, input.scheduledTime, input.cronExpression)

  const payload = {
    user_id: session.user.id,
    title: input.title.trim(),
    instruction: input.instruction.trim(),
    task_type: input.taskType || 'custom_prompt',
    schedule_type: input.scheduleType,
    scheduled_time: input.scheduledTime || '08:30',
    cron_expression: input.cronExpression || null,
    timezone: 'Asia/Jerusalem',
    client_id: clientId,
    is_active: true,
    next_run_at: nextRun.toISOString(),
  }

  const { data, error } = await db
    .from('v2_agent_scheduled_tasks')
    .insert(payload)
    .select('*, client:clients(id, name)')
    .single()

  if (error || !data) {
    throw new Error(`[agent-scheduler] create task failed: ${error?.message}`)
  }

  return {
    ...data,
    client_name: (data as any).client?.name || undefined,
  }
}

/**
 * Updates an agent scheduled task
 */
export async function updateAgentScheduledTask(
  id: string,
  updates: Partial<CreateAgentScheduledTaskInput> & { is_active?: boolean }
): Promise<AgentScheduledTask> {
  await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()

  const dbUpdates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (updates.title) dbUpdates.title = updates.title.trim()
  if (updates.instruction) dbUpdates.instruction = updates.instruction.trim()
  if (updates.taskType) dbUpdates.task_type = updates.taskType
  if (updates.scheduleType) dbUpdates.schedule_type = updates.scheduleType
  if (updates.scheduledTime !== undefined) dbUpdates.scheduled_time = updates.scheduledTime
  if (updates.cronExpression !== undefined) dbUpdates.cron_expression = updates.cronExpression
  if (updates.clientId !== undefined) dbUpdates.client_id = updates.clientId
  if (updates.is_active !== undefined) dbUpdates.is_active = updates.is_active

  if (updates.scheduleType || updates.scheduledTime || updates.cronExpression) {
    dbUpdates.next_run_at = calculateNextRun(
      updates.scheduleType || 'daily',
      updates.scheduledTime,
      updates.cronExpression
    ).toISOString()
  }

  const { data, error } = await db
    .from('v2_agent_scheduled_tasks')
    .update(dbUpdates)
    .eq('id', id)
    .select('*, client:clients(id, name)')
    .single()

  if (error || !data) {
    throw new Error(`[agent-scheduler] update task failed: ${error?.message}`)
  }

  return {
    ...data,
    client_name: (data as any).client?.name || undefined,
  }
}

/**
 * Deletes an agent scheduled task
 */
export async function deleteAgentScheduledTask(id: string): Promise<boolean> {
  await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()
  const { error } = await db.from('v2_agent_scheduled_tasks').delete().eq('id', id)
  if (error) {
    throw new Error(`[agent-scheduler] delete task failed: ${error.message}`)
  }
  return true
}

/**
 * Toggles an agent scheduled task between active and paused
 */
export async function toggleAgentScheduledTask(id: string, isActive: boolean): Promise<AgentScheduledTask> {
  return updateAgentScheduledTask(id, { is_active: isActive })
}

/**
 * Executes an individual agent task autonomously using AI tools.
 * Gathers intelligence, writes logs, and optionally stores a Studio artifact.
 */
export async function executeAgentScheduledTask(task: AgentScheduledTask): Promise<{
  success: boolean
  summary: string
  error?: string
}> {
  const db = getWorkspaceAdminDb()
  const now = new Date()

  // Set status to running
  await db
    .from('v2_agent_scheduled_tasks')
    .update({ last_run_status: 'running' })
    .eq('id', task.id)

  try {
    const tools = createGlobalAgentTools({ autonomous: true })

    const prompt = `אתה פועל כסוכן הניהול האוטונומי של נחמיה (Executive Autonomous Agent) שהופעל עבור משימה מתוזמנת:
שם המשימה: "${task.title}"
הוראת המשימה:
${task.instruction}

${task.client_id ? `שיוך ללקוח מזהה: "${task.client_id}". במידת הצורך השתמש בכלים עם מזהה זה.` : 'משימה רוחבית לסוכנות.'}

הנחיות ביצוע קריטיות:
1. השתמש בכלים הנחוצים (קריאת מיילים, סריקת יומן, בדיקת גיליונות, שליפת משימות) כדי לבצע את המשימה במלואה.
2. שמירת כרטיסים ותוצרים בסטודיו (Studio): כל כרטיס מידע, סיכום, דוח או תוכנית פעולה נשמרים ישירות לסטודיו באופן אוטומטי ומיידי. לעולם אל תגיד או תכתוב לנחמיה שאתה "ממתין לאישור שמירת הכרטיס" או "נדרש אישור". שמירת תוצרים מתבצעת ללא צורך באישור כלל!
3. נסח סיכום פעולה מקצועי, מסודר וברור בעברית כולל תובנות עסקיות, פעולות שננקטו וממצאי מפתח.
4. הדגש מספרים, תאריכים וחריגות הדורשות את תשומת לבו של נחמיה.`

    const aiResult = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
      tools,
      stopWhen: stepCountIs(8),
    })

    const summary = aiResult.text || 'המשימה בוצעה בהצלחה.'

    // If output is substantial, also archive as an artifact in the Studio repository
    if (summary.length > 100) {
      try {
        await saveNotebookArtifact({
          clientId: task.client_id,
          artifactType: 'action_plan',
          title: `סיכום ביצוע אוטונומי: ${task.title}`,
          contentMd: summary,
          metadata: {
            scheduledTaskId: task.id,
            executedAt: now.toISOString(),
            taskType: task.task_type,
          },
        })
      } catch (artifactErr) {
        console.warn('[agent-scheduler] Failed to create studio artifact for task:', artifactErr)
      }
    }

    // Compute next run
    let nextRunISO: string
    let shouldDeactivate = false

    if (task.schedule_type === 'once') {
      shouldDeactivate = true
      nextRunISO = now.toISOString()
    } else {
      const nextDate = calculateNextRun(task.schedule_type, task.scheduled_time, task.cron_expression, now)
      nextRunISO = nextDate.toISOString()
    }

    await db
      .from('v2_agent_scheduled_tasks')
      .update({
        last_run_at: now.toISOString(),
        last_run_status: 'success',
        last_run_result: {
          summary,
          executedAt: now.toISOString(),
          stepsCount: aiResult.steps?.length || 1,
        },
        next_run_at: nextRunISO,
        is_active: shouldDeactivate ? false : task.is_active,
        updated_at: now.toISOString(),
      })
      .eq('id', task.id)

    return { success: true, summary }
  } catch (err: any) {
    console.error(`[agent-scheduler] Task "${task.title}" execution failed:`, err)

    const nextDate = calculateNextRun(task.schedule_type, task.scheduled_time, task.cron_expression, now)

    await db
      .from('v2_agent_scheduled_tasks')
      .update({
        last_run_at: now.toISOString(),
        last_run_status: 'failed',
        last_run_result: {
          error: err.message || 'Unknown error',
          failedAt: now.toISOString(),
        },
        next_run_at: nextDate.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', task.id)

    return { success: false, summary: '', error: err.message }
  }
}

/**
 * Runs all active agent tasks that are currently due (next_run_at <= now())
 */
export async function runPendingAgentScheduledTasks(limit = 10): Promise<{
  executed: number
  results: Array<{ taskId: string; title: string; success: boolean; summary?: string; error?: string }>
}> {
  const db = getWorkspaceAdminDb()
  const now = new Date().toISOString()

  const { data: tasks, error } = await db
    .from('v2_agent_scheduled_tasks')
    .select('*, client:clients(id, name)')
    .eq('is_active', true)
    .lte('next_run_at', now)
    .order('next_run_at', { ascending: true })
    .limit(limit)

  if (error || !tasks || tasks.length === 0) {
    return { executed: 0, results: [] }
  }

  const results: Array<{ taskId: string; title: string; success: boolean; summary?: string; error?: string }> = []

  for (const t of tasks) {
    const formattedTask: AgentScheduledTask = {
      id: t.id,
      user_id: t.user_id,
      title: t.title,
      instruction: t.instruction,
      task_type: t.task_type,
      schedule_type: t.schedule_type,
      scheduled_time: t.scheduled_time,
      cron_expression: t.cron_expression,
      timezone: t.timezone || 'Asia/Jerusalem',
      client_id: t.client_id,
      is_active: t.is_active,
      last_run_at: t.last_run_at,
      last_run_status: t.last_run_status,
      last_run_result: t.last_run_result || {},
      next_run_at: t.next_run_at,
      created_at: t.created_at,
      updated_at: t.updated_at,
      client_name: t.client?.name || undefined,
    }

    const res = await executeAgentScheduledTask(formattedTask)
    results.push({
      taskId: t.id,
      title: t.title,
      success: res.success,
      summary: res.summary,
      error: res.error,
    })
  }

  return { executed: results.length, results }
}
