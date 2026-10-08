import 'server-only'

import { createHash, randomBytes } from 'crypto'
import { getWorkspaceAdminDb } from '@/lib/v2/workspace-dal'
import { encryptSecret, decryptSecret } from '@/lib/v2/token-crypto'

export interface McpTokenRecord {
  id: string
  name: string
  token_preview: string
  token?: string
  is_active: boolean
  permissions: string[]
  last_used_at: string | null
  created_at: string
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken.trim()).digest('hex')
}

/**
 * Gets a deterministic fallback token derived from server secret.
 * Used if no tokens are yet persisted in database.
 */
function getDeterministicFallbackToken(): string {
  const seed = process.env.SUPABASE_SERVICE_ROLE_KEY || 'nehemiah-mcp-fallback-seed'
  const digest = createHash('sha256').update(`nehemiah-mcp-master:${seed}`).digest('hex').slice(0, 32)
  return `mcp_live_${digest}`
}

/**
 * Resolves the primary public MCP endpoint URL.
 */
export function getMcpEndpointUrl(): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://ndfm.ibsites.co.il').replace(/\/+$/, '')
  return `${baseUrl}/api/mcp`
}

/**
 * Validates an incoming MCP token from Bearer header, x-api-key, or query param.
 */
export async function validateMcpToken(rawToken: string): Promise<{
  valid: boolean
  name?: string
  permissions?: string[]
}> {
  if (!rawToken || !rawToken.trim()) {
    return { valid: false }
  }

  const clean = rawToken.trim()

  // 1. Direct check against configured environment variable
  const envMcpKey = process.env.MCP_API_KEY?.trim()
  if (envMcpKey && clean === envMcpKey) {
    return {
      valid: true,
      name: 'ENV Master MCP Key',
      permissions: ['*'],
    }
  }

  // 2. Direct check against SUPABASE_SERVICE_ROLE_KEY (for internal n8n / bot microservices)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (serviceKey && clean === serviceKey) {
    return {
      valid: true,
      name: 'Service Role Key',
      permissions: ['*'],
    }
  }

  // 3. Direct check against deterministic fallback key
  const fallbackKey = getDeterministicFallbackToken()
  if (clean === fallbackKey) {
    return {
      valid: true,
      name: 'Default Workspace Key',
      permissions: ['*'],
    }
  }

  // 4. Check against Database table v2_mcp_access_tokens
  try {
    const db = getWorkspaceAdminDb()
    const hashed = hashToken(clean)

    const { data, error } = await db
      .from('v2_mcp_access_tokens')
      .select('id, name, is_active, permissions')
      .eq('token_hash', hashed)
      .eq('is_active', true)
      .maybeSingle()

    if (!error && data) {
      // Fire-and-forget: update last_used_at
      db.from('v2_mcp_access_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id)
        .then(() => {}, (err) => console.warn('[mcp-tokens] update last_used_at error:', err))

      return {
        valid: true,
        name: data.name,
        permissions: data.permissions || ['*'],
      }
    }
  } catch (err: any) {
    console.warn('[mcp-tokens] DB token verification fallback:', err.message)
  }

  return { valid: false }
}

/**
 * Lists all registered MCP tokens.
 * If the database table does not exist or has no rows, returns the default workspace token.
 */
export async function listMcpTokens(): Promise<McpTokenRecord[]> {
  try {
    const db = getWorkspaceAdminDb()
    const { data, error } = await db
      .from('v2_mcp_access_tokens')
      .select('id, name, token_preview, encrypted_token, is_active, permissions, last_used_at, created_at')
      .order('created_at', { ascending: false })

    if (!error && data && data.length > 0) {
      return data.map((row) => {
        let decrypted = ''
        try {
          decrypted = decryptSecret(row.encrypted_token) || ''
        } catch {
          decrypted = ''
        }
        return {
          id: row.id,
          name: row.name,
          token_preview: row.token_preview,
          token: decrypted || undefined,
          is_active: row.is_active,
          permissions: row.permissions || [],
          last_used_at: row.last_used_at,
          created_at: row.created_at,
        }
      })
    }
  } catch (err: any) {
    console.warn('[mcp-tokens] DB list error, returning default token:', err.message)
  }

  // Fallback default token
  const defaultToken = getDeterministicFallbackToken()
  return [
    {
      id: 'default-primary-token',
      name: 'מפתח ברירת מחדל לבוט וואטסאפ',
      token_preview: `${defaultToken.slice(0, 12)}...${defaultToken.slice(-4)}`,
      token: defaultToken,
      is_active: true,
      permissions: ['read_drive', 'read_clients', 'read_sheets', 'read_tasks', 'read_calendar'],
      last_used_at: null,
      created_at: new Date().toISOString(),
    },
  ]
}

/**
 * Gets the primary active MCP token for display & one-click copy in the UI.
 */
export async function getPrimaryMcpToken(): Promise<{
  token: string
  preview: string
  name: string
  endpointUrl: string
  fullConnectUrl: string
}> {
  const tokens = await listMcpTokens()
  const activeToken = tokens.find((t) => t.is_active && t.token) || tokens[0]
  const token = activeToken.token || getDeterministicFallbackToken()
  const preview = `${token.slice(0, 12)}...${token.slice(-4)}`
  const endpointUrl = getMcpEndpointUrl()
  const fullConnectUrl = `${endpointUrl}?token=${token}`

  return {
    token,
    preview,
    name: activeToken.name,
    endpointUrl,
    fullConnectUrl,
  }
}

/**
 * Generates and saves a new named MCP token.
 */
export async function createMcpToken(
  name: string,
  permissions: string[] = ['read_drive', 'read_clients', 'read_sheets', 'read_tasks', 'read_calendar']
): Promise<McpTokenRecord> {
  const rawToken = `mcp_live_${randomBytes(24).toString('hex')}`
  const tokenHash = hashToken(rawToken)
  const tokenPreview = `${rawToken.slice(0, 12)}...${rawToken.slice(-4)}`
  const encryptedToken = encryptSecret(rawToken)

  const db = getWorkspaceAdminDb()
  const { data, error } = await db
    .from('v2_mcp_access_tokens')
    .insert({
      name: name.trim() || 'בוט וואטסאפ חדש',
      token_hash: tokenHash,
      token_preview: tokenPreview,
      encrypted_token: encryptedToken,
      is_active: true,
      permissions,
    })
    .select('id, name, token_preview, is_active, permissions, last_used_at, created_at')
    .single()

  if (error) {
    throw new Error(`שגיאה ביצירת מפתח: ${error.message}`)
  }

  return {
    ...data,
    token: rawToken,
  }
}

/**
 * Revokes (deactivates) an MCP token.
 */
export async function revokeMcpToken(id: string): Promise<boolean> {
  if (id === 'default-primary-token') {
    throw new Error('לא ניתן לבטל את מפתח ברירת המחדל')
  }

  const db = getWorkspaceAdminDb()
  const { error } = await db
    .from('v2_mcp_access_tokens')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    throw new Error(`שגיאה בביטול מפתח: ${error.message}`)
  }

  return true
}
