import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'
import type { InternalFinanceMutation, PendingInternalFinanceMutation } from '@/types/internal-finance'

const mutationDraftBase = z.object({
  operation: z.enum(['append', 'update']),
  tab: z.enum(['income', 'expenses', 'retainers', 'invoices']),
  targetId: z.string().min(3).max(100).nullable(),
  values: z.record(z.string().min(1).max(100), z.string().max(2_000)),
  reason: z.string().min(2).max(1_000),
})

function requireMaterialFields(input: z.infer<typeof mutationDraftBase>, context: z.RefinementCtx) {
  if (input.operation === 'update') {
    if (!input.targetId) context.addIssue({ code: 'custom', path: ['targetId'], message: 'חסר מזהה הרשומה לעדכון' })
    if (!Object.keys(input.values).length) context.addIssue({ code: 'custom', path: ['values'], message: 'לא הוגדרו שדות לעדכון' })
    return
  }
  const required = {
    income: ['תאריך', 'לקוח', 'סכום כולל'],
    expenses: ['תאריך', 'ספק', 'קטגוריה', 'סכום כולל'],
    retainers: ['לקוח', 'סכום חודשי', 'סטטוס'],
    invoices: ['מספר חשבונית', 'לקוח', 'תאריך הפקה', 'סכום כולל', 'סטטוס'],
  }[input.tab]
  for (const field of required) {
    if (!input.values[field]?.trim()) context.addIssue({ code: 'custom', path: ['values', field], message: `חסר שדה חובה: ${field}` })
  }
}

export const internalFinanceMutationDraftSchema = mutationDraftBase.superRefine(requireMaterialFields)
export const internalFinanceMutationSchema = mutationDraftBase.extend({ id: z.string().min(8).max(100) }).superRefine(requireMaterialFields)

const signedPayloadSchema = z.object({
  mutation: internalFinanceMutationSchema,
  userId: z.string().uuid(),
  expiresAt: z.number().int().positive(),
})

function secret(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!value) throw new Error('[internal-finance] Missing signing secret')
  return value
}

function signature(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export async function createMutationConfirmation(mutation: InternalFinanceMutation, summary: string): Promise<PendingInternalFinanceMutation> {
  const session = await requireWorkspaceAdmin()
  const expiresAtMs = Date.now() + 15 * 60_000
  const payload = Buffer.from(JSON.stringify({ mutation, userId: session.user.id, expiresAt: expiresAtMs }), 'utf8').toString('base64url')
  return { ...mutation, token: `${payload}.${signature(payload)}`, expiresAt: new Date(expiresAtMs).toISOString(), summary }
}

export async function verifyMutationConfirmation(token: string): Promise<InternalFinanceMutation> {
  const session = await requireWorkspaceAdmin()
  const [payload, suppliedSignature, extra] = token.split('.')
  if (!payload || !suppliedSignature || extra) throw new Error('אישור הפעולה אינו תקין')
  const expected = Buffer.from(signature(payload))
  const supplied = Buffer.from(suppliedSignature)
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error('חתימת האישור אינה תקינה')
  const parsed = signedPayloadSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')))
  if (parsed.userId !== session.user.id) throw new Error('האישור שייך למשתמש אחר')
  if (parsed.expiresAt <= Date.now()) throw new Error('תוקף האישור פג; יש לבקש הצעה חדשה')
  return parsed.mutation
}
