'use server'

/**
 * src/app/workspace/actions/dashboard-builder.ts
 *
 * Server Actions for the Visual Dashboard Builder & Editor.
 * Allows Nehemiah to manually create, edit, reorder, resize, and delete dashboard widgets.
 */

import { revalidatePath } from 'next/cache'
import { getSpreadsheetMeta, getSheetData, formatRange } from '@/lib/google-sheets'
import {
  getWorkspaceAdminDb,
  getWorkspaceClient,
  parseWorkspaceClientId,
  requireWorkspaceAdmin,
} from '@/lib/v2/workspace-dal'
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
    const validId = parseWorkspaceClientId(clientId)
    const client = await getWorkspaceClient(validId)
    if (!client.google_sheet_id) {
      return { success: false, tabs: [], error: 'לא מוגדר גיליון Google Sheets ללקוח' }
    }

    const meta = await getSpreadsheetMeta(client.google_sheet_id)
    const eligibleTabs = meta.filter((tab) => tab.title !== 'בריפים חודשיים')

    const tabs: SheetTabHeaderInfo[] = await Promise.all(
      eligibleTabs.map(async (tab) => {
        try {
          const rawData = await getSheetData(client.google_sheet_id!, formatRange(tab.title, 'A1:ZZ1'))
          const headers = (rawData[0] || []).map((h) => String(h).trim()).filter(Boolean)
          return {
            title: tab.title,
            headers,
          }
        } catch (err) {
          console.warn(`[dashboard-builder] Failed to read headers for tab ${tab.title}:`, err)
          return { title: tab.title, headers: [] }
        }
      })
    )

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
    const validId = parseWorkspaceClientId(clientId)
    const validated = dashboardConfigSchema.parse(config)

    const db = getWorkspaceAdminDb()
    const { error } = await db
      .from('clients')
      .update({ dashboard_config_json: validated })
      .eq('id', validId)

    if (error) throw new Error(error.message)

    revalidatePath(`/workspace/clients/${validId}`)
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
    const validId = parseWorkspaceClientId(clientId)
    const client = await getWorkspaceClient(validId)
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
