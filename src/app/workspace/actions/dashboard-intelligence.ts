'use server'

import { revalidatePath } from 'next/cache'
import { proposeDashboardFromSheet } from '@/lib/v2/dashboard-intelligence'
import {
  getWorkspaceAdminDb,
  getWorkspaceClient,
  requireWorkspaceAdmin,
} from '@/lib/v2/workspace-dal'
import { clearMonthlyBriefs } from '@/lib/v2/monthly-brief'

import { getClientContext } from '@/lib/v2/client-context'

export async function analyzeAndGenerateDashboardAction(clientId: string) {
  try {
    await requireWorkspaceAdmin()
    const client = await getWorkspaceClient(clientId)
    if (!client.google_sheet_id) return { error: 'לא הוגדר גיליון Google Sheets ללקוח' }

    const context = await getClientContext(clientId)
    const proposal = await proposeDashboardFromSheet(client.google_sheet_id, context)
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

export async function resetClientAgentDataAction(
  clientId: string,
  options: { resetDashboard?: boolean; resetBriefs?: boolean; resetContext?: boolean } = {
    resetDashboard: true,
    resetBriefs: true,
    resetContext: true,
  }
) {
  try {
    await requireWorkspaceAdmin()
    const client = await getWorkspaceClient(clientId)

    const dbUpdates: Record<string, unknown> = {}
    if (options.resetDashboard) dbUpdates.dashboard_config_json = {}
    if (options.resetContext) dbUpdates.client_context_json = {}

    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await getWorkspaceAdminDb()
        .from('clients')
        .update(dbUpdates)
        .eq('id', client.id)
      if (error) throw new Error(error.message)
    }

    if (options.resetBriefs !== false) {
      try {
        await clearMonthlyBriefs(client.id)
      } catch (briefError) {
        console.warn('[resetClientAgentDataAction] Failed to clear monthly briefs:', briefError)
      }
    }

    revalidatePath(`/workspace/clients/${client.id}`)
    return { success: true as const }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'איפוס נתוני הסוכן נכשל' }
  }
}
