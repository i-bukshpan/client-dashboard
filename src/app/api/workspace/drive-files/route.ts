/**
 * GET /api/workspace/drive-files?folderId=XXX
 *
 * Returns files from a Google Drive folder.
 * Admin-only: validates session via Supabase cookie.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getClientFiles } from '@/lib/google-drive'
import {
  getWorkspaceClient,
  getWorkspaceErrorStatus,
  WorkspaceAccessError,
  requireWorkspaceAdmin,
} from '@/lib/v2/workspace-dal'
import { assertDriveFolderDescendsFrom } from '@/lib/v2/google-drive-security'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const folderId = request.nextUrl.searchParams.get('folderId')
  const clientId = request.nextUrl.searchParams.get('clientId')
  if (!folderId || !clientId) {
    return NextResponse.json({ error: 'clientId and folderId are required' }, { status: 400 })
  }

  try {
    await requireWorkspaceAdmin()
    const client = await getWorkspaceClient(clientId)
    if (!client.drive_folder_id) {
      throw new WorkspaceAccessError('NOT_FOUND', 'לא הוגדרה תיקיית Drive ללקוח')
    }
    await assertDriveFolderDescendsFrom(folderId, client.drive_folder_id)
    const files = await getClientFiles(folderId)
    return NextResponse.json({ files })
  } catch (error: unknown) {
    const status = getWorkspaceErrorStatus(error)
    if (status >= 500) console.error('[api/workspace/drive-files]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list Drive files' },
      { status }
    )
  }
}
