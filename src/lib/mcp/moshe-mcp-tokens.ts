import 'server-only'

import { createHash, randomBytes } from 'crypto'
import { getWorkspaceAdminDb } from '@/lib/v2/workspace-dal'
import { encryptSecret, decryptSecret } from '@/lib/v2/token-crypto'

export interface MosheMcpTokenRecord {
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
 * Gets a deterministic fallback token derived specifically for Moshe's portal.
 */
function getDeterministicMosheFallbackToken(): string {
  const seed = process.env.SUPABASE_SERVICE_ROLE_KEY || 'nehemiah-moshe-fallback-seed'
  const digest = createHash('sha256').update(`moshe-portal-mcp-master:${seed}`).digest('hex').slice(0, 32)
  return `mcp_moshe_${digest}`
}

/**
 * Resolves the public Moshe MCP endpoint URL.
 */
export function getMosheMcpEndpointUrl(): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://ndfm.ibsites.co.il').replace(/\/+$/, '')
  return `${baseUrl}/api/mcp/moshe`
}

/**
 * Validates an incoming MCP token for Moshe's portal.
 * Ensures the token is specifically authorized for Moshe portal data.
 */
export async function validateMosheMcpToken(rawToken: string): Promise<{
  valid: boolean
  name?: string
  permissions?: string[]
}> {
  if (!rawToken || !rawToken.trim()) {
    return { valid: false }
  }

  const clean = rawToken.trim()

  // 1. Direct check against configured environment variable for Moshe
  const envMosheKey = process.env.MOSHE_MCP_API_KEY?.trim()
  if (envMosheKey && clean === envMosheKey) {
    return {
      valid: true,
      name: 'ENV Moshe MCP Key',
      permissions: ['moshe:*'],
    }
  }

  // 2. Direct check against deterministic fallback key for Moshe
  const fallbackKey = getDeterministicMosheFallbackToken()
  if (clean === fallbackKey) {
    return {
      valid: true,
      name: 'מפתח ברירת מחדל — פורטל משה',
      permissions: ['moshe:*'],
    }
  }

  // 3. Direct check against service role key (for internal bot services)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (serviceKey && clean === serviceKey) {
    return {
      valid: true,
      name: 'Service Role Key (Moshe Portal)',
      permissions: ['moshe:*'],
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
      // Must have moshe permission OR start with Moshe token
      const perms = (data.permissions || []) as string[]
      const hasMoshePerm = perms.includes('*') || perms.some(p => p.startsWith('moshe')) || data.name.includes('משה') || clean.startsWith('mcp_moshe_')

      if (!hasMoshePerm) {
        return { valid: false }
      }

      // Fire-and-forget: update last_used_at
      void db
        .from('v2_mcp_access_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id)

      return {
        valid: true,
        name: data.name,
        permissions: data.permissions || ['moshe:*'],
      }
    }
  } catch (err: any) {
    console.warn('[moshe-mcp-tokens] DB token verification fallback:', err.message)
  }

  return { valid: false }
}

/**
 * Lists all MCP tokens associated with Moshe's portal.
 */
export async function listMosheMcpTokens(): Promise<MosheMcpTokenRecord[]> {
  try {
    const db = getWorkspaceAdminDb()
    const { data, error } = await db
      .from('v2_mcp_access_tokens')
      .select('id, name, token_preview, encrypted_token, is_active, permissions, last_used_at, created_at')
      .order('created_at', { ascending: false })

    if (!error && data && data.length > 0) {
      const mosheTokens = data.filter((row: any) => {
        const perms = (row.permissions || []) as string[]
        return perms.some(p => p.startsWith('moshe')) || row.name.includes('משה') || row.name.includes('Moshe')
      })

      if (mosheTokens.length > 0) {
        return mosheTokens.map((row) => {
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
            permissions: row.permissions || ['moshe:*'],
            last_used_at: row.last_used_at,
            created_at: row.created_at,
          }
        })
      }
    }
  } catch (err: any) {
    console.warn('[moshe-mcp-tokens] DB list error, returning default token:', err.message)
  }

  // Fallback default token
  const defaultToken = getDeterministicMosheFallbackToken()
  return [
    {
      id: 'default-moshe-token',
      name: 'מפתח ברירת מחדל — בוט וואטסאפ לפורטל משה',
      token_preview: `${defaultToken.slice(0, 14)}...${defaultToken.slice(-4)}`,
      token: defaultToken,
      is_active: true,
      permissions: ['moshe:read', 'moshe:write'],
      last_used_at: null,
      created_at: new Date().toISOString(),
    },
  ]
}

/**
 * Gets the primary active MCP token for Moshe's portal.
 */
export async function getMoshePrimaryMcpToken(): Promise<{
  token: string
  preview: string
  name: string
  endpointUrl: string
  fullConnectUrl: string
}> {
  const tokens = await listMosheMcpTokens()
  const activeToken = tokens.find((t) => t.is_active && t.token) || tokens[0]
  const token = activeToken.token || getDeterministicMosheFallbackToken()
  const preview = `${token.slice(0, 14)}...${token.slice(-4)}`
  const endpointUrl = getMosheMcpEndpointUrl()
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
 * Generates and saves a new named MCP token for Moshe's portal.
 */
export async function createMosheMcpToken(
  name: string,
  permissions: string[] = ['moshe:read', 'moshe:write']
): Promise<MosheMcpTokenRecord> {
  const cleanName = name?.trim() || `מפתח בוט לפורטל משה (${new Date().toLocaleDateString('he-IL')})`
  const rawBytes = randomBytes(24).toString('hex')
  const rawToken = `mcp_moshe_${rawBytes}`
  const tokenHash = hashToken(rawToken)
  const tokenPreview = `${rawToken.slice(0, 14)}...${rawToken.slice(-4)}`
  const encryptedToken = encryptSecret(rawToken)

  const db = getWorkspaceAdminDb()
  const { data, error } = await db
    .from('v2_mcp_access_tokens')
    .insert({
      name: cleanName,
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
    id: data.id,
    name: data.name,
    token_preview: data.token_preview,
    token: rawToken,
    is_active: data.is_active,
    permissions: data.permissions || permissions,
    last_used_at: data.last_used_at,
    created_at: data.created_at,
  }
}

/**
 * Revokes / deactivates an MCP token.
 */
export async function revokeMosheMcpToken(id: string): Promise<boolean> {
  if (id === 'default-moshe-token') {
    throw new Error('לא ניתן למחוק את מפתח ברירת המחדל של המערכת')
  }

  const db = getWorkspaceAdminDb()
  const { error } = await db
    .from('v2_mcp_access_tokens')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    throw new Error(`שגיאה בהשבתת מפתח: ${error.message}`)
  }
  return true
}
