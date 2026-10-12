import 'server-only'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { MOSHE_MCP_TOOLS, getMosheMcpToolsCatalog } from './moshe-mcp-tools'
import { validateMosheMcpToken, getMosheMcpEndpointUrl } from './moshe-mcp-tokens'

export const MOSHE_MCP_SERVER_INFO = {
  name: 'moshe-portal-mcp-server',
  version: '1.0.0',
  description: 'Moshe Parush Real Estate Portal MCP Server for External Bots & AI Agents',
}

/**
 * Creates and configures a fresh McpServer instance with only Moshe Portal tools.
 */
export function createConfiguredMosheMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: MOSHE_MCP_SERVER_INFO.name,
      version: MOSHE_MCP_SERVER_INFO.version,
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

  // Register only the Moshe tools
  for (const tool of MOSHE_MCP_TOOLS) {
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
          console.error(`[moshe-mcp-server] Tool execution error (${tool.name}):`, error)
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
 * CORS headers for cross-origin requests from external bot domains.
 */
export const MOSHE_MCP_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, MCP-Protocol-Version, Accept',
  'Access-Control-Max-Age': '86400',
}

export function handleMosheMcpCors(): Response {
  return new Response(null, {
    status: 204,
    headers: MOSHE_MCP_CORS_HEADERS,
  })
}

/**
 * Extracts and validates auth token from incoming request.
 */
export async function authenticateMosheMcpRequest(req: Request): Promise<{
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

  const auth = await validateMosheMcpToken(rawToken)
  if (!auth.valid) {
    const isHtml = (req.headers.get('Accept') || '').includes('text/html')

    if (isHtml) {
      return {
        authenticated: false,
        errorResponse: new Response(renderMosheMcpUnauthorizedHtml(), {
          status: 401,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            ...MOSHE_MCP_CORS_HEADERS,
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
            message: 'Unauthorized: Missing or invalid Moshe Portal MCP access token. Access is strictly limited to Moshe Portal.',
          },
          id: null,
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...MOSHE_MCP_CORS_HEADERS,
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
 * Main HTTP & SSE handler for Moshe MCP requests.
 */
export async function handleMosheMcpRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return handleMosheMcpCors()
  }

  // 1. Authenticate request strictly for Moshe Portal
  const auth = await authenticateMosheMcpRequest(req)
  if (!auth.authenticated || auth.errorResponse) {
    return auth.errorResponse!
  }

  const acceptHeader = req.headers.get('Accept') || ''
  const isHtml = acceptHeader.includes('text/html') && req.method === 'GET'

  // 2. Browser GET -> render rich dashboard / documentation
  if (isHtml) {
    return new Response(renderMosheMcpDiscoveryHtml(auth.tokenName), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...MOSHE_MCP_CORS_HEADERS,
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

  // 4. Initialize Streamable HTTP Transport
  try {
    const server = createConfiguredMosheMcpServer()
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })

    await server.connect(transport)
    const response = await transport.handleRequest(normalizedReq)

    // Append CORS headers to SDK response
    const resHeaders = new Headers(response.headers)
    for (const [k, v] of Object.entries(MOSHE_MCP_CORS_HEADERS)) {
      if (!resHeaders.has(k)) {
        resHeaders.set(k, v)
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
    })
  } catch (error: any) {
    console.error('[moshe-mcp-server] Transport handling failure:', error)
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: `Internal MCP Server Error: ${error.message || String(error)}`,
        },
        id: null,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...MOSHE_MCP_CORS_HEADERS,
        },
      }
    )
  }
}

// ── HTML Rendering for Browser Visits ────────────────────────────────────────

function renderMosheMcpDiscoveryHtml(tokenName?: string): string {
  const catalog = getMosheMcpToolsCatalog()
  const endpoint = getMosheMcpEndpointUrl()

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>פורטל משה פרוש — שרת MCP לבוטים חיצוניים</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --amber: #f59e0b;
      --emerald: #10b981;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Assistant', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 40px 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      background: rgba(245, 158, 11, 0.15);
      color: var(--amber);
      border: 1px solid rgba(245, 158, 11, 0.3);
      margin-bottom: 16px;
    }
    .title { font-size: 28px; font-weight: 800; margin-bottom: 8px; color: #fff; }
    .subtitle { color: var(--text-muted); font-size: 15px; margin-bottom: 32px; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .card-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; color: #fff; }
    .code-box {
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 14px 18px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: #38bdf8;
      overflow-x: auto;
      direction: ltr;
      text-align: left;
    }
    .tool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
    .tool-item {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 14px;
    }
    .tool-name { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; color: var(--amber); direction: ltr; text-align: left; margin-bottom: 4px; }
    .tool-title { font-weight: 700; font-size: 14px; color: #fff; margin-bottom: 4px; }
    .tool-desc { font-size: 12px; color: var(--text-muted); }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">● מחובר בהצלחה — ${tokenName || 'אימות מאושר'}</div>
    <h1 class="title">שרת MCP — פורטל משה פרוש</h1>
    <p class="subtitle">ערוץ אינטגרציה רשמי ומאובטח המאפשר לבוטים חיצוניים (WhatsApp, n8n, Claude, Cursor) לגשת למידע הנדל״ן של פורטל משה בלבד.</p>

    <div class="card">
      <div class="card-title">🔌 פרטי התחברות (Endpoint)</div>
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">כתובת ה-MCP Streamable HTTP / SSE:</p>
      <div class="code-box">${endpoint}</div>
    </div>

    <div class="card">
      <div class="card-title">🛠️ קטלוג הכלים הזמינים (${catalog.length} כלים ייחודיים)</div>
      <div class="tool-grid">
        ${catalog
          .map(
            (t) => `
          <div class="tool-item">
            <div class="tool-name">${t.name}</div>
            <div class="tool-title">${t.titleHebrew}</div>
            <div class="tool-desc">${t.description}</div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  </div>
</body>
</html>`
}

function renderMosheMcpUnauthorizedHtml(): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>נדרש אימות — פורטל משה MCP</title>
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .card { background: #1e293b; border: 1px solid #334155; padding: 32px; border-radius: 16px; max-width: 480px; }
    h1 { color: #ef4444; font-size: 20px; margin-bottom: 12px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
    code { background: #0f172a; color: #f59e0b; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <h1>אימות נכשל (401 Unauthorized)</h1>
    <p>גישה לשרת ה-MCP של פורטל משה דורשת מפתח תקין.<br>העבר את המפתח באמצעות כותרת <code>Authorization: Bearer &lt;token&gt;</code> או פרמטר <code>?token=&lt;token&gt;</code>.</p>
  </div>
</body>
</html>`
}
