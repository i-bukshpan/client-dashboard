'use server'

/**
 * src/app/workspace/actions/brief.ts
 *
 * Server Actions for on-demand Daily Brief generation.
 */

import { generateGlobalDailyBrief, type GlobalDailyBrief } from '@/lib/v2/global-daily-brief'
import { requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

export async function fetchGlobalDailyBriefAction(): Promise<{
  success: boolean
  data?: GlobalDailyBrief
  error?: string
}> {
  try {
    await requireWorkspaceAdmin()
    const brief = await generateGlobalDailyBrief()
    return { success: true, data: brief }
  } catch (error: any) {
    console.error('[fetchGlobalDailyBriefAction] Error:', error)
    return {
      success: false,
      error: error?.message || 'שגיאה בהפקת הבריף היומי של סוכן ה-AI',
    }
  }
}
