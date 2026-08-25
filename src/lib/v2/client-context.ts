import 'server-only'

import { getWorkspaceAdminDb, getWorkspaceClient, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'
import { clientContextSchema, type ClientContext } from '@/lib/v2/client-context-schema'

/**
 * Returns the parsed ClientContext for a client, or null if onboarding
 * has not been completed yet (empty object or invalid JSON).
 */
export async function getClientContext(clientId: string): Promise<ClientContext | null> {
  const client = await getWorkspaceClient(clientId)
  const raw = (client as unknown as Record<string, unknown>).client_context_json
  if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) return null
  const parsed = clientContextSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/**
 * Persists structured ClientContext to the database for a given client.
 * Called by the AI save_client_context tool once discovery is complete.
 */
export async function saveClientContext(clientId: string, context: ClientContext): Promise<void> {
  await requireWorkspaceAdmin()
  const { error } = await getWorkspaceAdminDb()
    .from('clients')
    .update({ client_context_json: context })
    .eq('id', clientId)
  if (error) throw new Error('[client-context] Save failed: ' + error.message)
}
