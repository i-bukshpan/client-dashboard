import { NextResponse } from 'next/server'
import { runPendingAgentScheduledTasks } from '@/lib/v2/agent-scheduler'
import { requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function checkServiceAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization')
  const apiKeyHeader = request.headers.get('x-api-key')
  let providedToken = ''
  if (authHeader?.startsWith('Bearer ')) providedToken = authHeader.substring(7)
  else if (authHeader) providedToken = authHeader
  else if (apiKeyHeader) providedToken = apiKeyHeader
  providedToken = providedToken.trim()

  const expectedKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const expectedCronSecret = (process.env.CRON_SECRET || '').trim()

  if (expectedCronSecret && providedToken === expectedCronSecret) return true
  if (expectedKey && providedToken === expectedKey) return true
  return false
}

export async function POST(request: Request) {
  const isAuthorized = checkServiceAuth(request)

  if (!isAuthorized) {
    try {
      await requireWorkspaceAdmin()
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const outcome = await runPendingAgentScheduledTasks(10)
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...outcome,
    })
  } catch (err: any) {
    console.error('[agent-tasks-cron] Execution failed:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
