import 'server-only'

import { createHash } from 'crypto'
import { getWorkspaceAdminDb, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

export interface JobProcessResult {
  processed: number
  succeeded: number
  failed: number
  errors: string[]
}

export async function enqueueWorkspaceJob(jobType: string, payload: Record<string, unknown>): Promise<string> {
  const session = await requireWorkspaceAdmin()
  const idempotencyKey = createHash('sha256')
    .update(`${jobType}\0${JSON.stringify(payload)}`)
    .digest('hex')
  const { data, error } = await getWorkspaceAdminDb().from('v2_job_outbox').upsert({
    user_id: session.user.id,
    job_type: jobType,
    idempotency_key: idempotencyKey,
    payload,
    status: 'pending',
    available_at: new Date().toISOString(),
  }, { onConflict: 'idempotency_key', ignoreDuplicates: true }).select('id').maybeSingle()
  if (error) throw new Error(`[job-outbox] ${error.message}`)
  return (data?.id as string | undefined) ?? idempotencyKey
}

/**
 * Drains pending jobs from the v2_job_outbox with exponential backoff and error tracking.
 */
export async function drainWorkspaceOutboxJobs(batchSize = 20): Promise<JobProcessResult> {
  const db = getWorkspaceAdminDb()
  const now = new Date()

  const { data: jobs, error } = await db
    .from('v2_job_outbox')
    .select('*')
    .eq('status', 'pending')
    .lte('available_at', now.toISOString())
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (error) {
    console.error('[job-outbox] Error fetching pending jobs:', error.message)
    return { processed: 0, succeeded: 0, failed: 0, errors: [error.message] }
  }

  if (!jobs || jobs.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, errors: [] }
  }

  const result: JobProcessResult = {
    processed: jobs.length,
    succeeded: 0,
    failed: 0,
    errors: [],
  }

  for (const job of jobs) {
    // Mark as processing
    await db
      .from('v2_job_outbox')
      .update({ status: 'processing', attempts: (job.attempts || 0) + 1 })
      .eq('id', job.id)

    try {
      if (job.job_type === 'spawn_recurring_workspace_task') {
        const { createWorkspaceTask } = await import('@/lib/v2/workspace-tasks')
        const p = job.payload as any
        await createWorkspaceTask({
          title: p.title,
          description: p.description,
          clientId: p.clientId,
          status: 'todo',
          priority: p.priority || 'medium',
          reminderMinutes: p.reminderMinutes,
          recurrence: p.recurrence,
          recurrenceDay: p.recurrenceDay,
          parentRecurringId: p.sourceTaskId,
        })
      } else {
        console.warn(`[job-outbox] Unknown job type: ${job.job_type}`)
      }

      // Mark completed
      await db
        .from('v2_job_outbox')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', job.id)

      result.succeeded++
    } catch (err: any) {
      console.error(`[job-outbox] Job ${job.id} failed:`, err)
      const currentAttempts = (job.attempts || 0) + 1
      const isPermanentFail = currentAttempts >= 5

      // Exponential backoff: (2^attempts) * 60 seconds
      const delayMinutes = Math.min(Math.pow(2, currentAttempts), 60)
      const nextAvailable = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()

      await db
        .from('v2_job_outbox')
        .update({
          status: isPermanentFail ? 'failed' : 'pending',
          available_at: nextAvailable,
          last_error: err.message || 'Unknown processing error',
        })
        .eq('id', job.id)

      result.failed++
      result.errors.push(`Job ${job.id} (${job.job_type}): ${err.message}`)
    }
  }

  return result
}
