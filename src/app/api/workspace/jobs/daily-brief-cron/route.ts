import { NextResponse } from 'next/server'
import { generateGlobalDailyBrief } from '@/lib/v2/global-daily-brief'
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
  const isAuthorizedCron = checkServiceAuth(request)

  if (!isAuthorizedCron) {
    try {
      await requireWorkspaceAdmin()
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const brief = await generateGlobalDailyBrief()
    return NextResponse.json({
      ok: true,
      generatedAt: brief.generatedAt,
      clientsCount: brief.stats.totalClients,
      routinesCount: brief.stats.routinesTodayCount,
      dueTodayCount: brief.stats.dueTodayTasksCount,
      overdueCount: brief.stats.overdueTasksCount,
    })
  } catch (err: any) {
    console.error('[daily-brief-cron] Error pre-generating brief:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
