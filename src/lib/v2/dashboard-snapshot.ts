import 'server-only'

import { createHash, randomBytes } from 'crypto'
import { buildSheetProfile } from '@/lib/v2/sheet-profiler'
import { dashboardConfigSchema } from '@/lib/v2/dashboard-schema'
import { getSheetRows } from '@/lib/google-sheets'
import { downloadFileFromDrive, uploadFileToDrive } from '@/lib/google-drive'
import { getWorkspaceAdminDb, getWorkspaceClient, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'
import type { DashboardSnapshot } from '@/types/dashboard-snapshot'

export function hashShareToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export async function buildDashboardSnapshot(clientId: string): Promise<DashboardSnapshot> {
  await requireWorkspaceAdmin()
  const client = await getWorkspaceClient(clientId)
  if (!client.google_sheet_id) throw new Error('לא הוגדר גיליון Google Sheets ללקוח')
  const configResult = dashboardConfigSchema.safeParse(client.dashboard_config_json)
  if (!configResult.success || configResult.data.widgets.length === 0) throw new Error('לא הוגדר דשבורד ללקוח')

  const profile = await buildSheetProfile(client.google_sheet_id)
  const sheets = [...new Set(configResult.data.widgets.map((widget) => widget.sheet))]
  const entries = await Promise.all(sheets.map(async (sheet) => [sheet, (await getSheetRows(client.google_sheet_id!, sheet)).slice(0, 1_000)] as const))
  return {
    version: 1,
    clientId: client.id,
    clientName: client.name,
    title: `דשבורד - ${client.name}`,
    generatedAt: new Date().toISOString(),
    sourceSpreadsheetId: client.google_sheet_id,
    profile,
    config: configResult.data,
    data: Object.fromEntries(entries),
  }
}

export async function saveSnapshotJson(snapshot: DashboardSnapshot): Promise<{ id: string; url: string }> {
  const client = await getWorkspaceClient(snapshot.clientId)
  if (!client.drive_folder_id) throw new Error('לא הוגדרה תיקיית Drive ללקוח')
  const stamp = snapshot.generatedAt.slice(0, 10)
  const file = await uploadFileToDrive(
    client.drive_folder_id,
    `dashboard-snapshot-${stamp}-${Date.now()}.json`,
    'application/json',
    Buffer.from(JSON.stringify(snapshot), 'utf8')
  )
  return { id: file.id, url: file.webViewLink }
}

export async function loadSnapshotJson(fileId: string): Promise<DashboardSnapshot> {
  const buffer = await downloadFileFromDrive(fileId)
  const parsed: unknown = JSON.parse(buffer.toString('utf8'))
  if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) {
    throw new Error('Invalid dashboard snapshot')
  }
  return parsed as DashboardSnapshot
}

export async function createDashboardShareGrant(input: {
  clientId: string
  title: string
  snapshotFileId: string
  pdfFileId: string | null
  expiresAt: string | null
}) {
  const session = await requireWorkspaceAdmin()
  await getWorkspaceClient(input.clientId)
  const token = randomBytes(32).toString('base64url')
  const { data, error } = await getWorkspaceAdminDb()
    .from('v2_dashboard_share_grants')
    .insert({
      client_id: input.clientId,
      title: input.title,
      token_hash: hashShareToken(token),
      snapshot_file_id: input.snapshotFileId,
      pdf_file_id: input.pdfFileId,
      expires_at: input.expiresAt,
      created_by: session.user.id,
    })
    .select('id, expires_at')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'יצירת קישור השיתוף נכשלה')
  return { token, id: data.id as string, expiresAt: data.expires_at as string | null }
}
