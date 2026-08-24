import 'server-only'

import { createHash, randomBytes } from 'crypto'
import { downloadFileFromDrive } from '@/lib/google-drive'
import { getWorkspaceAdminDb, getWorkspaceClient, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'
import type { MonthlyBriefRecord } from '@/types/monthly-brief'

function hashToken(token: string): string { return createHash('sha256').update(token, 'utf8').digest('hex') }

export async function createMonthlyBriefShare(input: { clientId: string; brief: MonthlyBriefRecord; expiresAt: string | null }) {
  const session = await requireWorkspaceAdmin()
  await getWorkspaceClient(input.clientId)
  if (input.brief.state !== 'approved' || !input.brief.snapshotFileId) throw new Error('ניתן לשתף רק בריף מאושר')
  const token = randomBytes(32).toString('base64url')
  const { data, error } = await getWorkspaceAdminDb().from('v2_monthly_brief_share_grants').insert({ client_id: input.clientId, brief_id: input.brief.id, report_month: input.brief.reportMonth, token_hash: hashToken(token), snapshot_file_id: input.brief.snapshotFileId, expires_at: input.expiresAt, created_by: session.user.id }).select('id, expires_at').single()
  if (error || !data) throw new Error(error?.message ?? 'יצירת קישור הבריף נכשלה')
  return { token, id: data.id as string, expiresAt: data.expires_at as string | null }
}

export async function resolvePublicMonthlyBrief(token: string): Promise<MonthlyBriefRecord | null> {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null
  const db = getWorkspaceAdminDb()
  const { data, error } = await db.from('v2_monthly_brief_share_grants').select('id, snapshot_file_id, expires_at, revoked_at, view_count').eq('token_hash', hashToken(token)).maybeSingle()
  if (error || !data || data.revoked_at || (data.expires_at && new Date(data.expires_at).getTime() <= Date.now())) return null
  const parsed: unknown = JSON.parse((await downloadFileFromDrive(data.snapshot_file_id)).toString('utf8'))
  if (!parsed || typeof parsed !== 'object' || (parsed as { state?: unknown }).state !== 'approved') return null
  void db.from('v2_monthly_brief_share_grants').update({ last_viewed_at: new Date().toISOString(), view_count: Number(data.view_count ?? 0) + 1 }).eq('id', data.id).then(() => undefined)
  return parsed as MonthlyBriefRecord
}
