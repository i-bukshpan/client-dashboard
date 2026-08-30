import { NextRequest, NextResponse } from 'next/server'
import { generateGlobalDailyBrief } from '@/lib/v2/global-daily-brief'
import { requireWorkspaceAdmin, getWorkspaceErrorStatus } from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/v2/daily-brief
 * Generates and returns the aggregated Executive Daily Brief with AI synthesis and WhatsApp text.
 */
export async function GET(request: NextRequest) {
  try {
    await requireWorkspaceAdmin()
    const brief = await generateGlobalDailyBrief()

    return NextResponse.json({
      success: true,
      brief,
    })
  } catch (error: unknown) {
    console.error('[API /api/v2/daily-brief] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Daily brief generation failed' },
      { status: getWorkspaceErrorStatus(error) }
    )
  }
}
