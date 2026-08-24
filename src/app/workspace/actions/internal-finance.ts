'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { applyInternalFinanceMutation, newInternalFinanceMutationId, setupInternalAgencyWorkspace } from '@/lib/v2/internal-finance'
import { createMutationConfirmation, internalFinanceMutationDraftSchema, verifyMutationConfirmation } from '@/lib/v2/internal-finance-confirmation'
import { requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

export async function setupInternalAgencyAction() {
  try {
    await requireWorkspaceAdmin()
    const settings = await setupInternalAgencyWorkspace()
    revalidatePath('/workspace/internal-finance')
    return { success: true as const, settings }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'הקמת סביבת הכספים נכשלה' }
  }
}

export async function proposeInternalFinanceMutationAction(raw: unknown) {
  try {
    await requireWorkspaceAdmin()
    const input = internalFinanceMutationDraftSchema.parse(raw)
    const mutation = { ...input, id: newInternalFinanceMutationId() }
    const pending = await createMutationConfirmation(mutation, input.reason)
    return { success: true as const, pending }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'יצירת הצעת הפעולה נכשלה' }
  }
}

export async function confirmInternalFinanceMutationAction(raw: { token: string; confirmed: boolean }) {
  try {
    await requireWorkspaceAdmin()
    const input = z.object({ token: z.string().min(40).max(20_000), confirmed: z.literal(true) }).parse(raw)
    const mutation = await verifyMutationConfirmation(input.token)
    await applyInternalFinanceMutation(mutation)
    revalidatePath('/workspace/internal-finance')
    return { success: true as const, mutationId: mutation.id }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'הפעולה הכספית נכשלה' }
  }
}
