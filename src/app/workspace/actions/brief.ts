'use server'

/**
 * src/app/workspace/actions/brief.ts
 *
 * Server Actions for on-demand Daily Brief generation.
 */

import { getOrGenerateGlobalDailyBrief, type GlobalDailyBrief } from '@/lib/v2/global-daily-brief'
import { requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

export async function fetchGlobalDailyBriefAction(forceRefresh = false): Promise<{
  success: boolean
  data?: GlobalDailyBrief
  cached?: boolean
  error?: string
}> {
  try {
    await requireWorkspaceAdmin()
    const { brief, cached } = await getOrGenerateGlobalDailyBrief(forceRefresh)
    return { success: true, data: brief, cached }
  } catch (error: any) {
    console.error('[fetchGlobalDailyBriefAction] Error:', error)
    return {
      success: false,
      error: error?.message || 'שגיאה בהפקת הבריף היומי של סוכן ה-AI',
    }
  }
}
