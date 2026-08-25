/**
 * GET & POST /api/workspace/daily-brief
 *
 * Dedicated Global Daily Brief endpoint for Nehemiah OS v2.
 * Can be called by:
 * 1. Logged-in workspace admin via browser / UI
 * 2. External automation (n8n, WhatsApp bot, Cron job) using:
 *    Authorization: Bearer <CRON_SECRET | SUPABASE_SERVICE_ROLE_KEY | DAILY_BRIEF_TOKEN>
 *
 * Query params:
 *  - ?format=json (default) -> returns full GlobalDailyBrief object
 *  - ?format=text -> returns Content-Type text/plain with whatsappFormattedText
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateGlobalDailyBrief } from '@/lib/v2/global-daily-brief'
import { requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function authenticateRequest(request: NextRequest): Promise<boolean> {
  // 1. Check Bearer Token (for external bots, n8n, WhatsApp service, cron)
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim()
    const validTokens = [
      process.env.CRON_SECRET,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      process.env.DAILY_BRIEF_TOKEN,
    ].filter(Boolean)

    if (validTokens.includes(token)) {
      return true
    }
  }

  // 2. Check Workspace Admin Session (cookie / supabase user)
  try {
    await requireWorkspaceAdmin()
    return true
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const isAuthed = await authenticateRequest(request)
  if (!isAuthed) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid admin session or Bearer token.' },
      { status: 401 }
    )
  }

  try {
    const brief = await generateGlobalDailyBrief()
    const url = new URL(request.url)
    const format = url.searchParams.get('format')

    if (format === 'text') {
      return new Response(brief.whatsappFormattedText, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    }

    return NextResponse.json(brief, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: unknown) {
    console.error('[daily-brief-api] Generation failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Daily brief generation failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // POST can be used by webhooks / triggers to request generation and return payload
  return GET(request)
}
