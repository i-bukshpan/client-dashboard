import 'server-only'

import { getWorkspaceAdminDb } from '@/lib/v2/workspace-dal'
import { hashShareToken, loadSnapshotJson } from '@/lib/v2/dashboard-snapshot'

export async function resolvePublicDashboardShare(token: string) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null
  const db = getWorkspaceAdminDb()
  const { data, error } = await db
    .from('v2_dashboard_share_grants')
    .select('id, title, snapshot_file_id, pdf_file_id, expires_at, revoked_at, view_count')
    .eq('token_hash', hashShareToken(token))
    .maybeSingle()
  if (error || !data || data.revoked_at) return null
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null

  const snapshot = await loadSnapshotJson(data.snapshot_file_id)
  void db.from('v2_dashboard_share_grants').update({
    last_viewed_at: new Date().toISOString(),
    view_count: Number(data.view_count ?? 0) + 1,
  }).eq('id', data.id).then(() => undefined)

  return {
    id: data.id as string,
    title: data.title as string,
    pdfFileId: data.pdf_file_id as string | null,
    expiresAt: data.expires_at as string | null,
    snapshot,
  }
}
