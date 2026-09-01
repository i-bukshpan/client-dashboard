import 'server-only'

import { createHash } from 'crypto'
import { z } from 'zod'
import { getWorkspaceAdminDb, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

export const confirmationIdSchema = z.string().uuid().optional()

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'confirmationId')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function payloadHash(actionType: string, payload: unknown): string {
  return createHash('sha256').update(`${actionType}\0${canonical(payload)}`).digest('hex')
}

export type ConfirmationGate =
  | { approved: true }
  | { approved: false; pending: true; confirmationId: string; confirmationMessage: string }

export async function requireAgentConfirmation(
  actionType: string,
  payload: unknown,
  confirmationId: string | undefined,
  confirmationMessage: string
): Promise<ConfirmationGate> {
  const session = await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()
  const hash = payloadHash(actionType, payload)

  if (!confirmationId) {
    const { data, error } = await db.from('v2_agent_confirmations').insert({
      user_id: session.user.id,
      action_type: actionType,
      payload_hash: hash,
    }).select('id').single()
    if (error || !data) throw new Error(error?.message ?? 'שמירת בקשת האישור נכשלה')
    return { approved: false, pending: true, confirmationId: data.id as string, confirmationMessage }
  }

  const { data, error } = await db.from('v2_agent_confirmations')
    .select('id')
    .eq('id', confirmationId)
    .eq('user_id', session.user.id)
    .eq('action_type', actionType)
    .eq('payload_hash', hash)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('האישור אינו תקף, פג תוקף, או שאינו תואם בדיוק לפעולה המבוקשת')

  const { data: consumed, error: consumeError } = await db.from('v2_agent_confirmations')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', confirmationId)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle()
  if (consumeError) throw new Error(consumeError.message)
  if (!consumed) throw new Error('האישור כבר נוצל')
  return { approved: true }
}
