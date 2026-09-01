import 'server-only'

import { createHash } from 'crypto'
import { getWorkspaceAdminDb, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

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
