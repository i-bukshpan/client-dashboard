'use server'

import { requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'
import {
  getPrimaryMcpToken,
  listMcpTokens,
  createMcpToken,
  revokeMcpToken,
  getMcpEndpointUrl,
} from '@/lib/mcp/mcp-tokens'
import { getMcpToolsCatalog } from '@/lib/mcp/mcp-tools'

export async function getMcpConnectionInfoAction() {
  await requireWorkspaceAdmin()

  const primary = await getPrimaryMcpToken()
  const tokens = await listMcpTokens()
  const tools = getMcpToolsCatalog()
  const endpointUrl = getMcpEndpointUrl()

  const configObj = {
    mcpServers: {
      nehemiah_os: {
        url: `${endpointUrl}?token=${primary.token}`,
        transport: 'streamable-http',
        headers: {
          Authorization: `Bearer ${primary.token}`,
        },
      },
    },
  }

  return {
    success: true,
    endpointUrl,
    fullConnectUrl: primary.fullConnectUrl,
    token: primary.token,
    tokenPreview: primary.preview,
    tokenName: primary.name,
    mcpConfigJson: JSON.stringify(configObj, null, 2),
    toolsCatalog: tools,
    allTokens: tokens,
  }
}

export async function generateNewMcpTokenAction(name: string) {
  await requireWorkspaceAdmin()
  try {
    const token = await createMcpToken(name)
    return { success: true, token }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function revokeMcpTokenAction(id: string) {
  await requireWorkspaceAdmin()
  try {
    await revokeMcpToken(id)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function testMcpConnectionAction(testToken?: string) {
  await requireWorkspaceAdmin()
  const startTime = Date.now()

  try {
    const primary = await getPrimaryMcpToken()
    const tokenToUse = testToken || primary.token
    const endpointUrl = getMcpEndpointUrl()

    // Test tools/list via POST JSON-RPC
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenToUse}`,
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
      cache: 'no-store',
    })

    const latencyMs = Date.now() - startTime
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: `שגיאת שרת: ${res.status} ${res.statusText}`,
        latencyMs,
      }
    }

    const data = await res.json()
    const tools = data?.result?.tools || []

    return {
      success: true,
      status: res.status,
      latencyMs,
      toolCount: tools.length,
      protocolVersion: '2024-11-05',
    }
  } catch (err: any) {
    return {
      success: false,
      error: `בדיקת החיבור נכשלה: ${err.message}`,
      latencyMs: Date.now() - startTime,
    }
  }
}
