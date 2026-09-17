import 'server-only'

import { getWorkspaceAdminDb, requireWorkspaceAdmin, parseWorkspaceClientId } from '@/lib/v2/workspace-dal'
import { encryptSecret, decryptSecret } from '@/lib/v2/token-crypto'

// ── 1. Client Assets (Multi-Sheets & Multi-Drive) ────────────────────────────

export type ClientAssetType = 'sheet' | 'drive_folder' | 'link'
export type ClientAssetCategory =
  | 'general'
  | 'invoices'
  | 'cash_flow'
  | 'project_taboo'
  | 'tama38'
  | 'tax_cpa'
  | 'contracts'

export interface ClientAsset {
  id: string
  clientId: string
  assetType: ClientAssetType
  assetId: string
  name: string
  category: ClientAssetCategory
  isPrimary: boolean
  notes: string | null
  url?: string
  createdAt: string
  updatedAt: string
}

export function formatAssetUrl(assetType: ClientAssetType, assetId: string): string {
  if (assetType === 'sheet') {
    return assetId.startsWith('http') ? assetId : `https://docs.google.com/spreadsheets/d/${assetId}`
  }
  if (assetType === 'drive_folder') {
    return assetId.startsWith('http') ? assetId : `https://drive.google.com/drive/folders/${assetId}`
  }
  return assetId
}

export async function listClientAssets(clientId: string): Promise<ClientAsset[]> {
  await requireWorkspaceAdmin()
  const validClientId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const { data, error } = await db
    .from('v2_client_assets')
    .select('*')
    .eq('client_id', validClientId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('[client-ecosystem-dal] listClientAssets error:', error.message)
    return []
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    clientId: row.client_id,
    assetType: row.asset_type,
    assetId: row.asset_id,
    name: row.name,
    category: row.category,
    isPrimary: Boolean(row.is_primary),
    notes: row.notes,
    url: formatAssetUrl(row.asset_type, row.asset_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function addClientAsset(
  clientId: string,
  asset: {
    assetType: ClientAssetType
    assetId: string
    name: string
    category?: ClientAssetCategory
    isPrimary?: boolean
    notes?: string
  }
): Promise<ClientAsset> {
  await requireWorkspaceAdmin()
  const validClientId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  // Clean raw URLs to get actual IDs if user pasted full URL
  let cleanAssetId = asset.assetId.trim()
  if (asset.assetType === 'sheet') {
    const match = cleanAssetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (match?.[1]) cleanAssetId = match[1]
  } else if (asset.assetType === 'drive_folder') {
    const match = cleanAssetId.match(/\/folders\/([a-zA-Z0-9-_]+)/)
    if (match?.[1]) cleanAssetId = match[1]
  }

  if (asset.isPrimary) {
    // Unset current primary of same type
    await db
      .from('v2_client_assets')
      .update({ is_primary: false })
      .eq('client_id', validClientId)
      .eq('asset_type', asset.assetType)
  }

  const { data, error } = await db
    .from('v2_client_assets')
    .insert({
      client_id: validClientId,
      asset_type: asset.assetType,
      asset_id: cleanAssetId,
      name: asset.name.trim(),
      category: asset.category || 'general',
      is_primary: Boolean(asset.isPrimary),
      notes: asset.notes?.trim() || null,
    })
    .select('*')
    .single()

  if (error) throw new Error(`[client-ecosystem-dal] addClientAsset failed: ${error.message}`)

  return {
    id: data.id,
    clientId: data.client_id,
    assetType: data.asset_type,
    assetId: data.asset_id,
    name: data.name,
    category: data.category,
    isPrimary: data.is_primary,
    notes: data.notes,
    url: formatAssetUrl(data.asset_type, data.asset_id),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function deleteClientAsset(id: string, clientId: string): Promise<boolean> {
  await requireWorkspaceAdmin()
  const validClientId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const { error } = await db
    .from('v2_client_assets')
    .delete()
    .eq('id', id)
    .eq('client_id', validClientId)

  if (error) throw new Error(`[client-ecosystem-dal] deleteClientAsset failed: ${error.message}`)
  return true
}

// ── 2. Client Vault (Secure Credentials) ─────────────────────────────────────

export interface ClientVaultItem {
  id: string
  clientId: string
  institutionName: string
  accountIdentifier: string | null
  username: string
  portalUrl: string | null
  notes: string | null
  updatedAt: string
}

export interface ClientVaultItemWithSecret extends ClientVaultItem {
  secret: string
}

export async function listClientVaultItems(clientId: string): Promise<ClientVaultItem[]> {
  await requireWorkspaceAdmin()
  const validClientId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const { data, error } = await db
    .from('v2_client_vault')
    .select('id, client_id, institution_name, account_identifier, username_encrypted, portal_url, notes, updated_at')
    .eq('client_id', validClientId)
    .order('institution_name', { ascending: true })

  if (error) {
    console.warn('[client-ecosystem-dal] listClientVaultItems error:', error.message)
    return []
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    clientId: row.client_id,
    institutionName: row.institution_name,
    accountIdentifier: row.account_identifier,
    username: decryptSecret(row.username_encrypted) || '***',
    portalUrl: row.portal_url,
    notes: row.notes,
    updatedAt: row.updated_at,
  }))
}

export async function saveClientVaultItem(
  clientId: string,
  item: {
    id?: string
    institutionName: string
    accountIdentifier?: string
    username: string
    secret: string
    portalUrl?: string
    notes?: string
  }
): Promise<ClientVaultItem> {
  await requireWorkspaceAdmin()
  const validClientId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const encryptedUsername = encryptSecret(item.username.trim())
  const encryptedSecret = encryptSecret(item.secret.trim())

  const payload = {
    client_id: validClientId,
    institution_name: item.institutionName.trim(),
    account_identifier: item.accountIdentifier?.trim() || null,
    username_encrypted: encryptedUsername,
    secret_encrypted: encryptedSecret,
    portal_url: item.portalUrl?.trim() || null,
    notes: item.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  let resData: any
  if (item.id) {
    const { data, error } = await db
      .from('v2_client_vault')
      .update(payload)
      .eq('id', item.id)
      .eq('client_id', validClientId)
      .select('*')
      .single()
    if (error) throw new Error(`[client-ecosystem-dal] updateClientVault failed: ${error.message}`)
    resData = data
  } else {
    const { data, error } = await db
      .from('v2_client_vault')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw new Error(`[client-ecosystem-dal] insertClientVault failed: ${error.message}`)
    resData = data
  }

  return {
    id: resData.id,
    clientId: resData.client_id,
    institutionName: resData.institution_name,
    accountIdentifier: resData.account_identifier,
    username: item.username.trim(),
    portalUrl: resData.portal_url,
    notes: resData.notes,
    updatedAt: resData.updated_at,
  }
}

export async function revealClientVaultSecret(id: string, clientId: string): Promise<string> {
  await requireWorkspaceAdmin()
  const validClientId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const { data, error } = await db
    .from('v2_client_vault')
    .select('secret_encrypted')
    .eq('id', id)
    .eq('client_id', validClientId)
    .single()

  if (error || !data) throw new Error('פריט הכספת לא נמצא')
  const decrypted = decryptSecret(data.secret_encrypted)
  if (!decrypted) throw new Error('פענוח הסיסמה נכשל')
  return decrypted
}

export async function deleteClientVaultItem(id: string, clientId: string): Promise<boolean> {
  await requireWorkspaceAdmin()
  const validClientId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const { error } = await db
    .from('v2_client_vault')
    .delete()
    .eq('id', id)
    .eq('client_id', validClientId)

  if (error) throw new Error(`[client-ecosystem-dal] deleteClientVaultItem failed: ${error.message}`)
  return true
}

// ── 3. Client Routines (Cadence: 1st, 5th, Monthly) ─────────────────────────

export type RoutineFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly'
export type RoutineAssignedRole = 'nehemiah' | 'secretary' | 'cpa' | 'client'

export interface ClientRoutine {
  id: string
  clientId: string
  clientName?: string
  title: string
  description: string | null
  dayOfMonth: number
  frequency: RoutineFrequency
  assignedRole: RoutineAssignedRole
  isActive: boolean
  lastExecutedAt: string | null
  createdAt: string
  updatedAt: string
}

export async function listClientRoutines(clientId: string): Promise<ClientRoutine[]> {
  await requireWorkspaceAdmin()
  const validClientId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const { data, error } = await db
    .from('v2_client_routines')
    .select('*')
    .eq('client_id', validClientId)
    .order('day_of_month', { ascending: true })

  if (error) {
    console.warn('[client-ecosystem-dal] listClientRoutines error:', error.message)
    return []
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    description: row.description,
    dayOfMonth: row.day_of_month,
    frequency: row.frequency,
    assignedRole: row.assigned_role,
    isActive: Boolean(row.is_active),
    lastExecutedAt: row.last_executed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function listTodayRoutinesAcrossWorkspace(
  targetDay?: number,
  options?: { skipAdminCheck?: boolean }
): Promise<ClientRoutine[]> {
  if (!options?.skipAdminCheck) {
    await requireWorkspaceAdmin()
  }
  const db = getWorkspaceAdminDb()
  const day = targetDay ?? new Date().getDate()

  const { data, error } = await db
    .from('v2_client_routines')
    .select('*, clients(id, name)')
    .eq('is_active', true)
    .eq('day_of_month', day)

  if (error) {
    console.warn('[client-ecosystem-dal] listTodayRoutines error:', error.message)
    return []
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name || 'לקוח',
    title: row.title,
    description: row.description,
    dayOfMonth: row.day_of_month,
    frequency: row.frequency,
    assignedRole: row.assigned_role,
    isActive: row.is_active,
    lastExecutedAt: row.last_executed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function saveClientRoutine(
  clientId: string,
  routine: {
    id?: string
    title: string
    description?: string
    dayOfMonth: number
    frequency?: RoutineFrequency
    assignedRole?: RoutineAssignedRole
    isActive?: boolean
  }
): Promise<ClientRoutine> {
  await requireWorkspaceAdmin()
  const validClientId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const payload = {
    client_id: validClientId,
    title: routine.title.trim(),
    description: routine.description?.trim() || null,
    day_of_month: Math.max(1, Math.min(31, routine.dayOfMonth)),
    frequency: routine.frequency || 'monthly',
    assigned_role: routine.assignedRole || 'nehemiah',
    is_active: routine.isActive !== undefined ? routine.isActive : true,
    updated_at: new Date().toISOString(),
  }

  let resData: any
  if (routine.id) {
    const { data, error } = await db
      .from('v2_client_routines')
      .update(payload)
      .eq('id', routine.id)
      .eq('client_id', validClientId)
      .select('*')
      .single()
    if (error) throw new Error(`[client-ecosystem-dal] updateRoutine failed: ${error.message}`)
    resData = data
  } else {
    const { data, error } = await db
      .from('v2_client_routines')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw new Error(`[client-ecosystem-dal] insertRoutine failed: ${error.message}`)
    resData = data
  }

  return {
    id: resData.id,
    clientId: resData.client_id,
    title: resData.title,
    description: resData.description,
    dayOfMonth: resData.day_of_month,
    frequency: resData.frequency,
    assignedRole: resData.assigned_role,
    isActive: resData.is_active,
    lastExecutedAt: resData.last_executed_at,
    createdAt: resData.created_at,
    updatedAt: resData.updated_at,
  }
}

export async function toggleClientRoutine(id: string, clientId: string, isActive: boolean): Promise<boolean> {
  await requireWorkspaceAdmin()
  const validClientId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const { error } = await db
    .from('v2_client_routines')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('client_id', validClientId)

  if (error) throw new Error(`[client-ecosystem-dal] toggleRoutine failed: ${error.message}`)
  return true
}

export async function deleteClientRoutine(id: string, clientId: string): Promise<boolean> {
  await requireWorkspaceAdmin()
  const validClientId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const { error } = await db
    .from('v2_client_routines')
    .delete()
    .eq('id', id)
    .eq('client_id', validClientId)

  if (error) throw new Error(`[client-ecosystem-dal] deleteRoutine failed: ${error.message}`)
  return true
}

// ── 4. Client Goals & Growth Milestones ──────────────────────────────────────

export type GoalStatus = 'on_track' | 'behind' | 'achieved' | 'paused'

export interface GoalMilestone {
  id: string
  title: string
  completed: boolean
  dueDate?: string
}

export interface ClientGoal {
  id: string
  clientId: string
  title: string
  description: string | null
  targetValue: number | null
  currentValue: number | null
  unit: string
  targetDate: string | null
  status: GoalStatus
  milestones: GoalMilestone[]
  progressPercent: number
  createdAt: string
  updatedAt: string
}

function calcGoalProgress(current: number | null, target: number | null, milestones: GoalMilestone[]): number {
  if (target && target > 0 && current !== null) {
    return Math.min(100, Math.max(0, Math.round((current / target) * 100)))
  }
  if (milestones.length > 0) {
    const done = milestones.filter((m) => m.completed).length
    return Math.round((done / milestones.length) * 100)
  }
  return 0
}

export async function listClientGoals(clientId: string): Promise<ClientGoal[]> {
  await requireWorkspaceAdmin()
  const validClientId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const { data, error } = await db
    .from('v2_client_goals')
    .select('*')
    .eq('client_id', validClientId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[client-ecosystem-dal] listClientGoals error:', error.message)
    return []
  }

  return (data || []).map((row: any) => {
    const milestones = Array.isArray(row.milestones_json) ? row.milestones_json : []
    const progressPercent = calcGoalProgress(row.current_value, row.target_value, milestones)
    return {
      id: row.id,
      clientId: row.client_id,
      title: row.title,
      description: row.description,
      targetValue: row.target_value !== null ? Number(row.target_value) : null,
      currentValue: row.current_value !== null ? Number(row.current_value) : null,
      unit: row.unit || '₪',
      targetDate: row.target_date,
      status: row.status,
      milestones,
      progressPercent,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  })
}

export async function saveClientGoal(
  clientId: string,
  goal: {
    id?: string
    title: string
    description?: string
    targetValue?: number | null
    currentValue?: number | null
    unit?: string
    targetDate?: string | null
    status?: GoalStatus
    milestones?: GoalMilestone[]
  }
): Promise<ClientGoal> {
  await requireWorkspaceAdmin()
  const validClientId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const payload = {
    client_id: validClientId,
    title: goal.title.trim(),
    description: goal.description?.trim() || null,
    target_value: goal.targetValue ?? null,
    current_value: goal.currentValue ?? null,
    unit: goal.unit || '₪',
    target_date: goal.targetDate || null,
    status: goal.status || 'on_track',
    milestones_json: goal.milestones || [],
    updated_at: new Date().toISOString(),
  }

  let resData: any
  if (goal.id) {
    const { data, error } = await db
      .from('v2_client_goals')
      .update(payload)
      .eq('id', goal.id)
      .eq('client_id', validClientId)
      .select('*')
      .single()
    if (error) throw new Error(`[client-ecosystem-dal] updateGoal failed: ${error.message}`)
    resData = data
  } else {
    const { data, error } = await db
      .from('v2_client_goals')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw new Error(`[client-ecosystem-dal] insertGoal failed: ${error.message}`)
    resData = data
  }

  const milestones = Array.isArray(resData.milestones_json) ? resData.milestones_json : []
  return {
    id: resData.id,
    clientId: resData.client_id,
    title: resData.title,
    description: resData.description,
    targetValue: resData.target_value !== null ? Number(resData.target_value) : null,
    currentValue: resData.current_value !== null ? Number(resData.current_value) : null,
    unit: resData.unit,
    targetDate: resData.target_date,
    status: resData.status,
    milestones,
    progressPercent: calcGoalProgress(resData.current_value, resData.target_value, milestones),
    createdAt: resData.created_at,
    updatedAt: resData.updated_at,
  }
}

export async function deleteClientGoal(id: string, clientId: string): Promise<boolean> {
  await requireWorkspaceAdmin()
  const validClientId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const { error } = await db
    .from('v2_client_goals')
    .delete()
    .eq('id', id)
    .eq('client_id', validClientId)

  if (error) throw new Error(`[client-ecosystem-dal] deleteGoal failed: ${error.message}`)
  return true
}
