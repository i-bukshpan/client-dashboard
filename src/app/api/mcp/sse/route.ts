/**
 * src/app/api/mcp/sse/route.ts
 *
 * SSE Alias route for MCP clients that explicitly connect to /api/mcp/sse.
 */

import { NextRequest } from 'next/server'
import { handleMcpRequest, handleMcpCors } from '@/lib/mcp/mcp-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  return handleMcpRequest(req)
}

export async function POST(req: NextRequest) {
  return handleMcpRequest(req)
}

export async function OPTIONS() {
  return handleMcpCors()
}
