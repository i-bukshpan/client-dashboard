import 'server-only'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { MCP_TOOLS, getMcpToolsCatalog } from './mcp-tools'
import { validateMcpToken } from './mcp-tokens'

export const MCP_SERVER_INFO = {
  name: 'nehemiah-os-mcp-server',
  version: '1.0.0',
  description: 'Nehemiah OS v3 Model Context Protocol (MCP) Server for WhatsApp Bot & External AI Integrations',
}

/**
 * Creates and configures a fresh McpServer instance with all workspace tools.
 */
export function createConfiguredMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: MCP_SERVER_INFO.name,
      version: MCP_SERVER_INFO.version,
    },
    {
      capabilities: {
        tools: {
          listChanged: true,
        },
        resources: {
          listChanged: false,
        },
      },
    }
  )

  // Register all 14 tools
  for (const tool of MCP_TOOLS) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema.shape,
      async (args: any) => {
        try {
          const result = await tool.execute(args)
          return {
            content: [
              {
                type: 'text' as const,
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
              },
            ],
            isError: !!(result && typeof result === 'object' && 'error' in result),
          }
        } catch (error: any) {
          console.error(`[mcp-server] Tool execution error (${tool.name}):`, error)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  error: `שגיאה בהפעלת הכלי ${tool.name}: ${error.message || String(error)}`,
                }),
              },
            ],
            isError: true,
          }
        }
      }
    )
  }

  return server
}

/**
 * CORS headers for cross-origin requests from external bot domains (e.g. n8n.ibsites.co.il).
 */
export const MCP_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, MCP-Protocol-Version, Accept',
  'Access-Control-Max-Age': '86400',
}

export function handleMcpCors(): Response {
  return new Response(null, {
    status: 204,
    headers: MCP_CORS_HEADERS,
  })
}

/**
 * Extracts and validates auth token from incoming request.
 */
export async function authenticateMcpRequest(req: Request): Promise<{
  authenticated: boolean
  tokenName?: string
  errorResponse?: Response
}> {
  const url = new URL(req.url)
  const authHeader = req.headers.get('Authorization')
  const apiKeyHeader = req.headers.get('x-api-key')
  const queryToken = url.searchParams.get('token') || url.searchParams.get('apiKey')

  let rawToken = ''
  if (authHeader?.startsWith('Bearer ')) {
    rawToken = authHeader.slice(7).trim()
  } else if (authHeader) {
    rawToken = authHeader.trim()
  } else if (apiKeyHeader) {
    rawToken = apiKeyHeader.trim()
  } else if (queryToken) {
    rawToken = queryToken.trim()
  }

  const auth = await validateMcpToken(rawToken)
  if (!auth.valid) {
    const isHtml = (req.headers.get('Accept') || '').includes('text/html')

    if (isHtml) {
      return {
        authenticated: false,
        errorResponse: new Response(renderMcpUnauthorizedHtml(), {
          status: 401,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            ...MCP_CORS_HEADERS,
          },
        }),
      }
    }

    return {
      authenticated: false,
      errorResponse: new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Unauthorized: Missing or invalid MCP access token. Provide via Authorization header, x-api-key, or ?token= query parameter.',
          },
          id: null,
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...MCP_CORS_HEADERS,
          },
        }
      ),
    }
  }

  return {
    authenticated: true,
    tokenName: auth.name,
  }
}

/**
 * Main HTTP & SSE handler for MCP requests.
 */
export async function handleMcpRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return handleMcpCors()
  }

  // 1. Authenticate request
  const auth = await authenticateMcpRequest(req)
  if (!auth.authenticated || auth.errorResponse) {
    return auth.errorResponse!
  }

  const acceptHeader = req.headers.get('Accept') || ''
  const isHtml = acceptHeader.includes('text/html') && req.method === 'GET'

  // 2. Browser GET -> render rich dashboard / documentation
  if (isHtml) {
    return new Response(renderMcpDiscoveryHtml(auth.tokenName), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...MCP_CORS_HEADERS,
      },
    })
  }

  // 3. Normalize Accept header for SDK streamable HTTP transport
  const headers = new Headers(req.headers)
  if (!acceptHeader.includes('text/event-stream')) {
    headers.set('accept', acceptHeader ? `${acceptHeader}, text/event-stream` : 'application/json, text/event-stream')
  }

  const bodyBuffer = req.method !== 'GET' && req.method !== 'HEAD' ? await req.clone().arrayBuffer() : undefined
  const normalizedReq = new Request(req.url, {
    method: req.method,
    headers,
    body: bodyBuffer,
  })

  // 4. Per-request transport and MCP server
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  const mcpServer = createConfiguredMcpServer()
  await mcpServer.connect(transport)

  // 5. Delegate request execution
  const response = await transport.handleRequest(normalizedReq)

  // 6. Merge CORS headers into response
  const responseHeaders = new Headers(response.headers)
  for (const [key, val] of Object.entries(MCP_CORS_HEADERS)) {
    responseHeaders.set(key, val)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

// ── HTML Visual Discovery Pages ──────────────────────────────────────────────

function renderMcpDiscoveryHtml(tokenName?: string): string {
  const catalog = getMcpToolsCatalog()
  const toolsHtml = catalog
    .map(
      (t) => `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 18px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <code style="color: #818cf8; font-weight: bold; font-size: 14px;">${t.name}</code>
          <span style="font-size: 11px; background: rgba(99,102,241,0.15); color: #a5b4fc; padding: 2px 8px; border-radius: 6px; font-weight: 600;">${t.category}</span>
        </div>
        <div style="font-size: 13px; color: #e2e8f0; font-weight: 500; margin-bottom: 4px;">${t.titleHebrew}</div>
        <div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">${t.description}</div>
      </div>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nehemiah OS — שרת MCP פעיל</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #090d16; color: #f8fafc; margin: 0; padding: 32px 20px; line-height: 1.5; }
    .container { max-width: 820px; margin: 0 auto; }
    .badge-live { display: inline-flex; align-items: center; gap: 8px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; }
    .pulse { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 10px #10b981; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
    .card { background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; margin-top: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h1 { font-size: 24px; margin: 16px 0 6px 0; color: #fff; }
    p { color: #94a3b8; margin: 0 0 16px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge-live">
      <span class="pulse"></span>
      שרת Model Context Protocol (MCP) פעיל ומחובר
    </div>
    <div class="card">
      <h1>Nehemiah OS — שרת MCP לבוט וואטסאפ ואינטגרציות</h1>
      <p>שרת ה-MCP מאפשר לבוט הוואטסאפ באתר השני לתשאל את נתוני נחמיה: חיפוש קבצי Google Drive, דשבורד לקוחות, גיליונות, משימות ויומן.</p>
      
      <div style="background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.25); border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px;">
        <span style="color: #a5b4fc; font-weight: bold;">אימות:</span> מחובר ומאושר באמצעות <strong>${tokenName || 'מפתח מאושר'}</strong> (גישה מאובטחת).
      </div>

      <h3 style="font-size: 16px; margin: 20px 0 12px 0; color: #cbd5e1;">14 כלים מבצעיים זמינים לבוט (Tools):</h3>
      ${toolsHtml}
    </div>
  </div>
</body>
</html>`
}

function renderMcpUnauthorizedHtml(): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>אימות נדרש — Nehemiah OS MCP</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #090d16; color: #f8fafc; padding: 40px 20px; text-align: center; }
    .box { max-width: 520px; margin: 40px auto; background: #111827; border: 1px solid #ef4444; border-radius: 16px; padding: 32px; }
    h2 { color: #f87171; margin-top: 0; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    code { background: #1f2937; padding: 4px 8px; border-radius: 6px; color: #fbbf24; font-size: 12px; }
  </style>
</head>
<body>
  <div class="box">
    <h2>🔒 נדרש מפתח אימות (MCP Token)</h2>
    <p>הגישה לשרת ה-MCP של נחמיה מוגנת. עליך לספק מפתח גישה תקף באמצעות כותרת <code>Authorization: Bearer &lt;token&gt;</code> או פרמטר <code>?token=&lt;token&gt;</code>.</p>
    <p>תוכל להעתיק את הקישור המלא בלחיצה אחת מתוך סביבת העבודה החדשה של נחמיה.</p>
  </div>
</body>
</html>`
}
