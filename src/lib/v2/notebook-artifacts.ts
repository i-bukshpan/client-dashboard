import 'server-only'

/**
 * src/lib/v2/notebook-artifacts.ts
 *
 * Data Access Layer (DAL) for Nehemiah OS v3 Studio Artifacts.
 * Handles persistence, retrieval, updates, pinning, and secure public sharing tokens
 * for AI-generated artifacts (Cards, Briefs, Charts, Action Plans, Tables, Meeting Preps).
 */

import crypto from 'crypto'
import {
  getWorkspaceAdminDb,
  requireWorkspaceAdmin,
  parseWorkspaceClientId,
} from '@/lib/v2/workspace-dal'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ArtifactType = 'card' | 'brief' | 'chart' | 'action_plan' | 'table' | 'meeting_prep'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid(val: unknown): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val)
}

export interface NotebookArtifactRecord {
  id: string
  client_id: string | null
  artifact_type: ArtifactType
  title: string
  content_json: Record<string, unknown>
  content_md: string | null
  metadata: Record<string, unknown>
  is_pinned: boolean
  share_token: string | null
  share_expires: string | null
  created_at: string
  updated_at: string
}

export interface CreateArtifactInput {
  id?: string
  clientId?: string | null
  artifactType: ArtifactType
  title: string
  contentJson?: Record<string, unknown>
  contentMd?: string | null
  metadata?: Record<string, unknown>
  isPinned?: boolean
}

export interface UpdateArtifactInput {
  title?: string
  contentJson?: Record<string, unknown>
  contentMd?: string | null
  metadata?: Record<string, unknown>
  isPinned?: boolean
}

// ── Operations ─────────────────────────────────────────────────────────────────

/**
 * Save a new artifact to the Studio.
 */
export async function saveNotebookArtifact(
  input: CreateArtifactInput
): Promise<NotebookArtifactRecord> {
  await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()

  const validClientId = input.clientId ? parseWorkspaceClientId(input.clientId) : null

  const insertPayload: Record<string, unknown> = {
    client_id: validClientId,
    artifact_type: input.artifactType,
    title: input.title.trim(),
    content_json: input.contentJson || {},
    content_md: input.contentMd || null,
    metadata: input.metadata || {},
    is_pinned: input.isPinned ?? false,
  }

  if (input.id && isValidUuid(input.id)) {
    insertPayload.id = input.id
  }

  const { data, error } = await db
    .from('v3_notebook_artifacts')
    .insert(insertPayload)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`שגיאה בשמירת ארטיפקט בסטודיו: ${error?.message || 'שגיאה לא ידועה'}`)
  }

  return data as NotebookArtifactRecord
}

/**
 * List artifacts for a client or global studio.
 */
export async function listNotebookArtifacts(
  clientId?: string | null,
  options?: { type?: ArtifactType; limit?: number }
): Promise<NotebookArtifactRecord[]> {
  await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()

  let query = db
    .from('v3_notebook_artifacts')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (clientId) {
    const validId = parseWorkspaceClientId(clientId)
    query = query.eq('client_id', validId)
  } else {
    // If explicitly null or undefined without client context, get all agency artifacts
    query = query.is('client_id', null)
  }

  if (options?.type) {
    query = query.eq('artifact_type', options.type)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    const errCode = (error as any)?.code
    const errMsg = (error as any)?.message || ''
    const isExpected =
      errCode === '42501' ||
      errCode === '42P01' ||
      errMsg.includes('permission denied') ||
      errMsg.includes('does not exist') ||
      errMsg.includes('relation')

    if (!isExpected && errCode) {
      console.error('[notebook-artifacts] list error:', errMsg || errCode || error)
    } else {
      console.warn('[notebook-artifacts] v3_notebook_artifacts table status:', errMsg || errCode || 'table not yet migrated in Supabase')
    }
    return []
  }

  return (data || []) as NotebookArtifactRecord[]
}

/**
 * Get a single artifact by ID.
 */
export async function getNotebookArtifact(
  artifactId: string
): Promise<NotebookArtifactRecord | null> {
  if (!isValidUuid(artifactId)) return null

  await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()

  const { data, error } = await db
    .from('v3_notebook_artifacts')
    .select('*')
    .eq('id', artifactId)
    .single()

  if (error || !data) return null
  return data as NotebookArtifactRecord
}

/**
 * Update an existing artifact.
 */
export async function updateNotebookArtifact(
  artifactId: string,
  updates: UpdateArtifactInput
): Promise<NotebookArtifactRecord> {
  if (!isValidUuid(artifactId)) {
    throw new Error('מזהה ארטיפקט אינו תקין')
  }

  await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (updates.title !== undefined) payload.title = updates.title.trim()
  if (updates.contentJson !== undefined) payload.content_json = updates.contentJson
  if (updates.contentMd !== undefined) payload.content_md = updates.contentMd
  if (updates.metadata !== undefined) payload.metadata = updates.metadata
  if (updates.isPinned !== undefined) payload.is_pinned = updates.isPinned

  const { data, error } = await db
    .from('v3_notebook_artifacts')
    .update(payload)
    .eq('id', artifactId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`שגיאה בעדכון ארטיפקט: ${error?.message || 'שגיאה'}`)
  }

  return data as NotebookArtifactRecord
}

/**
 * Delete an artifact.
 */
export async function deleteNotebookArtifact(artifactId: string): Promise<boolean> {
  if (!isValidUuid(artifactId)) return false

  await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()

  const { error } = await db
    .from('v3_notebook_artifacts')
    .delete()
    .eq('id', artifactId)

  if (error) {
    throw new Error(`שגיאה במחיקת ארטיפקט: ${error.message}`)
  }

  return true
}

/**
 * Toggle pin status of an artifact.
 */
export async function togglePinArtifact(artifactId: string): Promise<boolean> {
  if (!isValidUuid(artifactId)) {
    throw new Error('ארטיפקט לא נמצא (מזהה אינו תקין)')
  }

  await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()

  const current = await getNotebookArtifact(artifactId)
  if (!current) throw new Error('ארטיפקט לא נמצא')

  const nextState = !current.is_pinned
  const { error } = await db
    .from('v3_notebook_artifacts')
    .update({ is_pinned: nextState, updated_at: new Date().toISOString() })
    .eq('id', artifactId)

  if (error) throw new Error(`שגיאה בנעיצת ארטיפקט: ${error.message}`)

  return nextState
}

/**
 * Generates a secure, time-limited share token for an artifact.
 */
export async function createArtifactShareLink(
  artifactId: string,
  expiresInDays: number = 14
): Promise<{ token: string; shareUrl: string; expiresAt: string }> {
  if (!isValidUuid(artifactId)) {
    throw new Error('ארטיפקט לא נמצא (מזהה אינו תקין)')
  }

  await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()

  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await db
    .from('v3_notebook_artifacts')
    .update({
      share_token: token,
      share_expires: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', artifactId)

  if (error) {
    throw new Error(`שגיאה בהפקת קישור שיתוף: ${error.message}`)
  }

  return {
    token,
    shareUrl: `/share/artifact/${token}`,
    expiresAt,
  }
}

/**
 * Fetches a shared artifact by token (public, validates expiry).
 */
export async function getSharedArtifact(
  token: string
): Promise<NotebookArtifactRecord | null> {
  const db = getWorkspaceAdminDb()

  const { data, error } = await db
    .from('v3_notebook_artifacts')
    .select('*')
    .eq('share_token', token)
    .single()

  if (error || !data) return null

  // Check expiry
  if (data.share_expires && new Date(data.share_expires) < new Date()) {
    return null
  }

  return data as NotebookArtifactRecord
}
