'use server'

import { revalidatePath } from 'next/cache'
import { proposeDashboardFromSheet } from '@/lib/v2/dashboard-intelligence'
import {
  getWorkspaceAdminDb,
  getWorkspaceClient,
  requireWorkspaceAdmin,
} from '@/lib/v2/workspace-dal'

export async function analyzeAndGenerateDashboardAction(clientId: string) {
  try {
    await requireWorkspaceAdmin()
    const client = await getWorkspaceClient(clientId)
    if (!client.google_sheet_id) return { error: 'לא הוגדר גיליון Google Sheets ללקוח' }

    const proposal = await proposeDashboardFromSheet(client.google_sheet_id)
    const { error } = await getWorkspaceAdminDb()
      .from('clients')
      .update({ dashboard_config_json: proposal.config })
      .eq('id', client.id)
    if (error) throw new Error(error.message)

    revalidatePath(`/workspace/clients/${client.id}`)
    return {
      success: true as const,
      widgetCount: proposal.config.widgets.length,
      source: proposal.source,
      confidence: proposal.profile.confidence,
      ambiguities: proposal.profile.ambiguities,
    }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'ניתוח הגיליון נכשל' }
  }
}
