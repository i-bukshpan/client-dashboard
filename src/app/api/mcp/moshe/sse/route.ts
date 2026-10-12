/**
 * src/app/api/mcp/moshe/sse/route.ts
 *
 * Dedicated Server-Sent Events (SSE) Endpoint for Moshe Parush MCP Server.
 */

import { NextRequest } from 'next/server'
import { handleMosheMcpRequest, handleMosheMcpCors } from '@/lib/mcp/moshe-mcp-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  return handleMosheMcpRequest(req)
}

export async function POST(req: NextRequest) {
  return handleMosheMcpRequest(req)
}

export async function OPTIONS() {
  return handleMosheMcpCors()
}
