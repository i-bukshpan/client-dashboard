/**
 * src/app/api/workspace/clients/[id]/dashboard-config/route.ts
 *
 * REST API for reading and updating client dashboard configuration.
 * GET  - Fetch current dashboard_config_json
 * PATCH - Update dashboard_config_json (validates admin session)
 */

import { NextRequest, NextResponse } from 'next/server'
import { dashboardConfigRequestSchema } from '@/lib/v2/dashboard-schema'
import {
  getWorkspaceAdminDb,
  getWorkspaceClient,
  getWorkspaceErrorStatus,
  parseWorkspaceClientId,
  requireWorkspaceAdmin,
} from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireWorkspaceAdmin()
    const { id } = await params
    const client = await getWorkspaceClient(id)
    return NextResponse.json({
      config: client.dashboard_config_json ?? { version: 1, widgets: [] },
      has_sheet: !!client.google_sheet_id,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: getWorkspaceErrorStatus(error) }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireWorkspaceAdmin()
    const { id: rawId } = await params
    await getWorkspaceClient(rawId)
    const id = parseWorkspaceClientId(rawId)
    const parsed = dashboardConfigRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid dashboard config', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const db = getWorkspaceAdminDb()
    const { error } = await db
      .from('clients')
      .update({ dashboard_config_json: parsed.data.config })
      .eq('id', id)

    if (error) throw new Error(`[dashboard-config] Update failed: ${error.message}`)
    return NextResponse.json({ success: true, config: parsed.data.config })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: getWorkspaceErrorStatus(error) }
    )
  }
}
