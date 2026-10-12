'use server'

import {
  getMoshePrimaryMcpToken,
  listMosheMcpTokens,
  createMosheMcpToken,
  revokeMosheMcpToken,
  getMosheMcpEndpointUrl,
} from '@/lib/mcp/moshe-mcp-tokens'
import { getMosheMcpToolsCatalog } from '@/lib/mcp/moshe-mcp-tools'

export async function getMosheMcpConnectionInfoAction() {
  const primary = await getMoshePrimaryMcpToken()
  const tokens = await listMosheMcpTokens()
  const tools = getMosheMcpToolsCatalog()
  const endpointUrl = getMosheMcpEndpointUrl()

  const configObj = {
    mcpServers: {
      moshe_portal: {
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

export async function generateNewMosheMcpTokenAction(name: string) {
  try {
    const token = await createMosheMcpToken(name)
    return { success: true, token }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function revokeMosheMcpTokenAction(id: string) {
  try {
    await revokeMosheMcpToken(id)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function testMosheMcpConnectionAction(testToken?: string) {
  const startTime = Date.now()

  try {
    const primary = await getMoshePrimaryMcpToken()
    const tokenToUse = testToken || primary.token
    const endpointUrl = getMosheMcpEndpointUrl()

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

    const json = await res.json()
    const toolCount = json?.result?.tools?.length || 0

    return {
      success: true,
      latencyMs,
      toolCount,
      serverInfo: json?.result || {},
    }
  } catch (err: any) {
    return {
      success: false,
      error: `שגיאת תקשורת: ${err.message}`,
      latencyMs: Date.now() - startTime,
    }
  }
}
