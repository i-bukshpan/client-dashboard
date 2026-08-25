import 'server-only'

import { cache } from 'react'
import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { isAdminEmail, getAdminEmail } from '@/lib/auth-helpers'
import type { DashboardConfig } from '@/types/dashboard'

const ClientIdSchema = z.string().uuid()

export type WorkspaceErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'

export class WorkspaceAccessError extends Error {
  constructor(
    public readonly code: WorkspaceErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'WorkspaceAccessError'
  }
}

export function getWorkspaceErrorStatus(error: unknown): number {
  if (!(error instanceof WorkspaceAccessError)) return 500
  if (error.code === 'UNAUTHENTICATED') return 401
  if (error.code === 'FORBIDDEN') return 403
  if (error.code === 'INVALID_INPUT') return 400
  return 404
}

function requireEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`[workspace-dal] Missing ${name}`)
  return value
}

/** Privileged DB access is intentionally available only through this v2 DAL. */
export const getWorkspaceAdminDb = cache(() =>
  createSupabaseClient(
    requireEnvironment('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
)

export interface WorkspaceAdminSession {
  user: User
  role: 'admin'
}

/**
 * Ensures that the environment-configured administrator also has the profile
 * row required by database foreign keys and RLS. The authenticated user's ID
 * is used dynamically; no administrator UUID is hardcoded.
 */
export async function ensureConfiguredWorkspaceAdminProfile(user: User): Promise<boolean> {
  if (!isAdminEmail(user.email)) return false
  const configuredAdminEmail = getAdminEmail()

  const metadataName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name.trim()
    : ''
  const { error } = await getWorkspaceAdminDb()
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email ?? configuredAdminEmail,
      full_name: metadataName || user.email?.split('@')[0] || 'Workspace Admin',
      role: 'admin',
    }, { onConflict: 'id' })

  if (error) throw new Error(`[workspace-dal] Admin profile synchronization failed: ${error.message}`)
  return true
}

/**
 * Authorizes a Nehemiah OS v2 request.
 * This must be called by every workspace/v2 page, Route Handler and Server Action.
 */
export const requireWorkspaceAdmin = cache(async (): Promise<WorkspaceAdminSession> => {
  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new WorkspaceAccessError('UNAUTHENTICATED', 'נדרשת התחברות למערכת')
  }

  if (await ensureConfiguredWorkspaceAdminProfile(user)) {
    return { user, role: 'admin' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || profile?.role !== 'admin') {
    throw new WorkspaceAccessError('FORBIDDEN', 'הגישה לסביבת העבודה מוגבלת למנהל')
  }

  return { user, role: 'admin' }
})

export interface WorkspaceClientRecord {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  id_number: string | null
  status: string | null
  drive_folder_id: string | null
  google_sheet_id: string | null
  dashboard_config_json: DashboardConfig | Record<string, never>
  /** Structured onboarding context. Empty object = discovery not yet completed. */
  client_context_json: Record<string, unknown>
  portfolio_value: number | null
  advisory_goal: string | null
  risk_level: string | null
  created_at: string
}

const WORKSPACE_CLIENT_COLUMNS = 'id, name, email, phone, address, id_number, status, drive_folder_id, google_sheet_id, dashboard_config_json, client_context_json, portfolio_value, advisory_goal, risk_level, created_at'

export function parseWorkspaceClientId(value: string): string {
  const result = ClientIdSchema.safeParse(value)
  if (!result.success) {
    throw new WorkspaceAccessError('INVALID_INPUT', 'מזהה לקוח אינו תקין')
  }
  return result.data
}

export async function getWorkspaceClient(clientId: string): Promise<WorkspaceClientRecord> {
  await requireWorkspaceAdmin()
  const id = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()
  const { data, error } = await db
    .from('clients')
    .select(WORKSPACE_CLIENT_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`[workspace-dal] Client query failed: ${error.message}`)
  if (!data) throw new WorkspaceAccessError('NOT_FOUND', 'הלקוח לא נמצא')
  return data as unknown as WorkspaceClientRecord
}

export async function listWorkspaceClients(): Promise<WorkspaceClientRecord[]> {
  await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()
  const { data, error } = await db
    .from('clients')
    .select(WORKSPACE_CLIENT_COLUMNS)
    .order('name')

  if (error) throw new Error(`[workspace-dal] Clients query failed: ${error.message}`)
  return (data ?? []) as unknown as WorkspaceClientRecord[]
}

export async function assertClientDriveRoot(
  clientId: string,
  folderId: string
): Promise<WorkspaceClientRecord> {
  const client = await getWorkspaceClient(clientId)
  if (!client.drive_folder_id || client.drive_folder_id !== folderId) {
    throw new WorkspaceAccessError('FORBIDDEN', 'תיקיית Drive אינה שייכת ללקוח')
  }
  return client
}
