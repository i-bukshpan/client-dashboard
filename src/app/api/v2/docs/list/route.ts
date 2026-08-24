import { NextRequest, NextResponse } from 'next/server'
import {
  getWorkspaceAdminDb,
  getWorkspaceClient,
  getWorkspaceErrorStatus,
  requireWorkspaceAdmin,
} from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireWorkspaceAdmin()
    const url = new URL(request.url)
    const clientId = url.searchParams.get('client_id')
    const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10)
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50
    if (clientId) await getWorkspaceClient(clientId)
    const db = getWorkspaceAdminDb()

    let query = db
      .from('v2_client_documents')
      .select('id, file_name, file_type, ocr_status, drive_url, file_date, amount, mime_type, file_size_bytes, created_at, client_id')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (clientId) query = query.eq('client_id', clientId)

    const { data, error } = await query
    if (error) throw new Error(`[v2/docs/list] Query failed: ${error.message}`)

    return NextResponse.json({ documents: data ?? [] })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: getWorkspaceErrorStatus(error) }
    )
  }
}
