'use server'

/**
 * src/app/workspace/actions/dashboard-builder.ts
 *
 * Server Actions for the Visual Dashboard Builder & Editor.
 * Allows Nehemiah to manually create, edit, reorder, resize, and delete dashboard widgets.
 */

import { revalidatePath } from 'next/cache'
import { getSpreadsheetMeta, getSheetData, formatRange } from '@/lib/google-sheets'
import { getWorkspaceAdminDb, getWorkspaceClient, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'
import { dashboardConfigSchema } from '@/lib/v2/dashboard-schema'
import type { DashboardConfig, DashboardWidget } from '@/types/dashboard'

export interface SheetTabHeaderInfo {
  title: string
  headers: string[]
}

/**
 * Fetches all available tabs and their column headers from the client's Google Sheet.
 */
export async function getSheetTabsWithHeadersAction(clientId: string): Promise<{
  success: boolean
  tabs: SheetTabHeaderInfo[]
  error?: string
}> {
  try {
    await requireWorkspaceAdmin()
    const client = await getWorkspaceClient(clientId)
    if (!client.google_sheet_id) {
      return { success: false, tabs: [], error: 'לא מוגדר גיליון Google Sheets ללקוח' }
    }

    const meta = await getSpreadsheetMeta(client.google_sheet_id)
    const tabs: SheetTabHeaderInfo[] = []

    for (const tab of meta) {
      if (tab.title === 'בריפים חודשיים') continue
      try {
        const rawData = await getSheetData(client.google_sheet_id, formatRange(tab.title, 'A1:ZZ1'))
        const headers = (rawData[0] || []).map((h) => String(h).trim()).filter(Boolean)
        tabs.push({
          title: tab.title,
          headers,
        })
      } catch (err) {
        console.warn(`[dashboard-builder] Failed to read headers for tab ${tab.title}:`, err)
        tabs.push({ title: tab.title, headers: [] })
      }
    }

    return { success: true, tabs }
  } catch (error: unknown) {
    return {
      success: false,
      tabs: [],
      error: error instanceof Error ? error.message : 'שגיאה בשליפת מבנה הגיליון',
    }
  }
}

/**
 * Saves a manual or edited DashboardConfig to the client record in Supabase.
 */
export async function saveDashboardConfigAction(
  clientId: string,
  config: DashboardConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireWorkspaceAdmin()
    const validated = dashboardConfigSchema.parse(config)

    const db = getWorkspaceAdminDb()
    const { error } = await db
      .from('clients')
      .update({ dashboard_config_json: validated })
      .eq('id', clientId)

    if (error) throw new Error(error.message)

    revalidatePath(`/workspace/clients/${clientId}`)
    return { success: true }
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'שגיאה בשמירת הגדרות הדשבורד',
    }
  }
}

/**
 * Gets the current DashboardConfig for a client.
 */
export async function getCurrentDashboardConfigAction(
  clientId: string
): Promise<{ success: boolean; config: DashboardConfig | null; error?: string }> {
  try {
    await requireWorkspaceAdmin()
    const client = await getWorkspaceClient(clientId)
    const parsed = dashboardConfigSchema.safeParse(client.dashboard_config_json)
    return {
      success: true,
      config: parsed.success ? parsed.data : null,
    }
  } catch (error: unknown) {
    return {
      success: false,
      config: null,
      error: error instanceof Error ? error.message : 'שגיאה בקריאת הגדרות הדשבורד',
    }
  }
}
