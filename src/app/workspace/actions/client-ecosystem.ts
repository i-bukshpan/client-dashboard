'use server'

import { revalidatePath } from 'next/cache'
import {
  listClientAssets,
  addClientAsset,
  deleteClientAsset,
  listClientVaultItems,
  saveClientVaultItem,
  revealClientVaultSecret,
  deleteClientVaultItem,
  listClientRoutines,
  saveClientRoutine,
  toggleClientRoutine,
  deleteClientRoutine,
  listClientGoals,
  saveClientGoal,
  deleteClientGoal,
  type ClientAsset,
  type ClientAssetType,
  type ClientAssetCategory,
  type ClientVaultItem,
  type ClientRoutine,
  type RoutineFrequency,
  type RoutineAssignedRole,
  type ClientGoal,
  type GoalStatus,
  type GoalMilestone,
} from '@/lib/v2/client-ecosystem-dal'
import { getClientContext, saveClientContext } from '@/lib/v2/client-context'
import type { ClientStakeholder } from '@/lib/v2/client-context-schema'

// ── 1. Client Assets Actions ────────────────────────────────────────────────

export async function getClientAssetsAction(clientId: string): Promise<{ success: boolean; assets: ClientAsset[]; error?: string }> {
  try {
    const assets = await listClientAssets(clientId)
    return { success: true, assets }
  } catch (err: any) {
    return { success: false, assets: [], error: err.message }
  }
}

export async function addClientAssetAction(input: {
  clientId: string
  assetType: ClientAssetType
  assetId: string
  name: string
  category?: ClientAssetCategory
  isPrimary?: boolean
  notes?: string
}): Promise<{ success: boolean; asset?: ClientAsset; error?: string }> {
  try {
    const asset = await addClientAsset(input.clientId, {
      assetType: input.assetType,
      assetId: input.assetId,
      name: input.name,
      category: input.category,
      isPrimary: input.isPrimary,
      notes: input.notes,
    })
    revalidatePath(`/workspace/clients/${input.clientId}`)
    return { success: true, asset }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deleteClientAssetAction(id: string, clientId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteClientAsset(id, clientId)
    revalidatePath(`/workspace/clients/${clientId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ── 2. Client Vault Actions ─────────────────────────────────────────────────

export async function getClientVaultItemsAction(clientId: string): Promise<{ success: boolean; items: ClientVaultItem[]; error?: string }> {
  try {
    const items = await listClientVaultItems(clientId)
    return { success: true, items }
  } catch (err: any) {
    return { success: false, items: [], error: err.message }
  }
}

export async function saveClientVaultItemAction(input: {
  id?: string
  clientId: string
  institutionName: string
  accountIdentifier?: string
  username: string
  secret: string
  portalUrl?: string
  notes?: string
}): Promise<{ success: boolean; item?: ClientVaultItem; error?: string }> {
  try {
    const item = await saveClientVaultItem(input.clientId, input)
    revalidatePath(`/workspace/clients/${input.clientId}`)
    return { success: true, item }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function revealClientVaultSecretAction(id: string, clientId: string): Promise<{ success: boolean; secret?: string; error?: string }> {
  try {
    const secret = await revealClientVaultSecret(id, clientId)
    return { success: true, secret }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deleteClientVaultItemAction(id: string, clientId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteClientVaultItem(id, clientId)
    revalidatePath(`/workspace/clients/${clientId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ── 3. Client Routines Actions ──────────────────────────────────────────────

export async function getClientRoutinesAction(clientId: string): Promise<{ success: boolean; routines: ClientRoutine[]; error?: string }> {
  try {
    const routines = await listClientRoutines(clientId)
    return { success: true, routines }
  } catch (err: any) {
    return { success: false, routines: [], error: err.message }
  }
}

export async function saveClientRoutineAction(input: {
  id?: string
  clientId: string
  title: string
  description?: string
  dayOfMonth: number
  frequency?: RoutineFrequency
  assignedRole?: RoutineAssignedRole
  isActive?: boolean
}): Promise<{ success: boolean; routine?: ClientRoutine; error?: string }> {
  try {
    const routine = await saveClientRoutine(input.clientId, input)
    revalidatePath(`/workspace/clients/${input.clientId}`)
    return { success: true, routine }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function toggleClientRoutineAction(id: string, clientId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    await toggleClientRoutine(id, clientId, isActive)
    revalidatePath(`/workspace/clients/${clientId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deleteClientRoutineAction(id: string, clientId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteClientRoutine(id, clientId)
    revalidatePath(`/workspace/clients/${clientId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ── 4. Client Goals Actions ─────────────────────────────────────────────────

export async function getClientGoalsAction(clientId: string): Promise<{ success: boolean; goals: ClientGoal[]; error?: string }> {
  try {
    const goals = await listClientGoals(clientId)
    return { success: true, goals }
  } catch (err: any) {
    return { success: false, goals: [], error: err.message }
  }
}

export async function saveClientGoalAction(input: {
  id?: string
  clientId: string
  title: string
  description?: string
  targetValue?: number | null
  currentValue?: number | null
  unit?: string
  targetDate?: string | null
  status?: GoalStatus
  milestones?: GoalMilestone[]
}): Promise<{ success: boolean; goal?: ClientGoal; error?: string }> {
  try {
    const goal = await saveClientGoal(input.clientId, input)
    revalidatePath(`/workspace/clients/${input.clientId}`)
    return { success: true, goal }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deleteClientGoalAction(id: string, clientId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteClientGoal(id, clientId)
    revalidatePath(`/workspace/clients/${clientId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ── 5. Client Stakeholders Actions ──────────────────────────────────────────

export async function addClientStakeholderAction(
  clientId: string,
  stakeholder: ClientStakeholder
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await getClientContext(clientId)
    const baseContext = existing || {
      version: 1,
      businessType: 'ייעוץ עסקי',
      businessDescription: 'תיק לקוח פעיל',
      stakeholders: [],
      nehemiahGoals: [],
      activePhases: [],
      keyMetrics: [],
      capturedAt: new Date().toISOString(),
    }

    const updatedStakeholders = [...(baseContext.stakeholders || []), stakeholder]
    await saveClientContext(clientId, {
      ...baseContext,
      stakeholders: updatedStakeholders,
    })

    revalidatePath(`/workspace/clients/${clientId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

