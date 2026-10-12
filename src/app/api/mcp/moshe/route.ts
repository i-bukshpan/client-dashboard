/**
 * src/app/api/mcp/moshe/route.ts
 *
 * Dedicated Model Context Protocol (MCP) HTTP / SSE Endpoint for Moshe Parush Portal.
 * Exposes live Moshe real estate projects, payments schedule & ledger, buyers, loans, partners,
 * neighbors, workers, and finance data to external WhatsApp bots and AI agents.
 *
 * Access is STRICTLY restricted to Moshe Portal data.
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
