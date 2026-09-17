import { NextResponse } from 'next/server'
import { drainWorkspaceOutboxJobs } from '@/lib/v2/job-outbox'
import { requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function checkServiceAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization')
  const apiKeyHeader = request.headers.get('x-api-key')
  let providedToken = ''
  if (authHeader?.startsWith('Bearer ')) providedToken = authHeader.substring(7)
  else if (authHeader) providedToken = authHeader
  else if (apiKeyHeader) providedToken = apiKeyHeader
  providedToken = providedToken.trim()

  const expectedKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  return !!(expectedKey && providedToken && providedToken === expectedKey)
}

export async function POST(request: Request) {
  const isAuthorizedCron = checkServiceAuth(request)

  if (!isAuthorizedCron) {
    try {
      await requireWorkspaceAdmin()
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const url = new URL(request.url)
    const batchSizeParam = url.searchParams.get('limit')
    const batchSize = batchSizeParam ? parseInt(batchSizeParam, 10) : 20

    const result = await drainWorkspaceOutboxJobs(isNaN(batchSize) ? 20 : batchSize)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[workspace-jobs-process] Error processing jobs:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
