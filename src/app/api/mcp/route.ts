/**
 * src/app/api/mcp/route.ts
 *
 * Model Context Protocol (MCP) HTTP / SSE Endpoint for Nehemiah OS.
 * Exposes live Google Drive file search, Client Dashboards & Sheets, CRM profiles,
 * Tasks, Calendar, and Moshe portal data to external WhatsApp bots and AI agents.
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
