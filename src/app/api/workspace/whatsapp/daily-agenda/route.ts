/**
 * GET & POST /api/workspace/whatsapp/daily-agenda
 *
 * Dedicated N8N & WhatsApp Bot Endpoint for Nehemiah OS v2.
 * Aggregates:
 * 1. Today's recurring client routines (1st, 5th, 15th of the month, etc.)
 * 2. Active client growth milestones
 * 3. High-priority workspace tasks
 *
 * Security:
 * Protected by Bearer Token (SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, WHATSAPP_BOT_SECRET)
 * or authenticated Workspace Admin session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { listTodayRoutinesAcrossWorkspace } from '@/lib/v2/client-ecosystem-dal'
import { getWorkspaceAdminDb, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function authenticateCaller(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim()
    const validTokens = [
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      process.env.CRON_SECRET,
      process.env.WHATSAPP_BOT_SECRET,
      process.env.N8N_WEBHOOK_SECRET,
    ].filter(Boolean)

    if (validTokens.includes(token)) {
      return true
    }
  }

  const apiKeyHeader = request.headers.get('x-api-key')
  if (apiKeyHeader && apiKeyHeader === process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return true
  }

  // Fallback: Admin session
  try {
    await requireWorkspaceAdmin()
    return true
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const isAuthed = await authenticateCaller(request)
  if (!isAuthed) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid Bearer token or admin session.' },
      { status: 401 }
    )
  }

  const url = new URL(request.url)
  const dayParam = url.searchParams.get('day')
  const format = url.searchParams.get('format') || 'json'
  const today = new Date()
  const targetDay = dayParam ? parseInt(dayParam, 10) : today.getDate()

  try {
    // 1. Fetch routines for today (across all clients)
    const routines = await listTodayRoutinesAcrossWorkspace(targetDay, { skipAdminCheck: true })

    // 2. Fetch active client goals
    const db = getWorkspaceAdminDb()
    const { data: rawGoals } = await db
      .from('v2_client_goals')
      .select('id, title, target_value, current_value, unit, status, clients(id, name)')
      .eq('status', 'in_progress')
      .limit(5)

    interface GoalAgendaItem {
      id: string
      title: string
      clientName: string
      targetValue: number | null
      currentValue: number | null
      unit: string | null
      status: string
    }

    const goals: GoalAgendaItem[] = ((rawGoals || []) as any[]).map((g: any) => ({
      id: g.id,
      title: g.title,
      clientName: g.clients?.name || 'לקוח',
      targetValue: g.target_value,
      currentValue: g.current_value,
      unit: g.unit,
      status: g.status,
    }))

    // 3. Format Date in Hebrew
    const formattedDate = today.toLocaleDateString('he-IL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Jerusalem',
    })

    // 4. Construct WhatsApp Message text
    const lines: string[] = [
      `🌅 *בוקר טוב נחמיה - סדר יום תפעולי למשרד*`,
      `📅 *תאריך:* ${formattedDate} (יום ${targetDay} לחודש)`,
      '',
    ]

    if (routines.length > 0) {
      lines.push(`📋 *שגרות וחיובים קבועים להיום (${routines.length}):*`)
      routines.forEach((r) => {
        const roleBadge =
          r.assignedRole === 'secretary'
            ? '👩‍💼 מזכירה'
            : r.assignedRole === 'cpa'
            ? '📊 רו"ח'
            : r.assignedRole === 'client'
            ? '👤 לקוח'
            : '💼 נחמיה'

        lines.push(`• *[${r.clientName}]* ${r.title}`)
        if (r.description) {
          lines.push(`  💬 ${r.description}`)
        }
        lines.push(`  📌 אחראי: ${roleBadge} | תדירות: ${r.frequency}`)
      })
      lines.push('')
    } else {
      lines.push(`✅ אין שגרות קבועות מתוזמנות ליום ה-${targetDay} לחודש.`)
      lines.push('')
    }

    if (goals.length > 0) {
      lines.push(`🎯 *יעדים עסקיים במוקד:*`)
      goals.forEach((g) => {
        lines.push(`• *[${g.clientName}]* ${g.title}: ${g.currentValue ?? 0} / ${g.targetValue ?? 0} ${g.unit || ''}`)
      })
      lines.push('')
    }

    lines.push(`🔗 *לוח הבקרה של המשרד:* https://ndfm.ibsites.co.il/workspace`)

    const whatsappMessage = lines.join('\n')

    if (format === 'text') {
      return new NextResponse(whatsappMessage, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    return NextResponse.json({
      ok: true,
      dayOfMonth: targetDay,
      formattedDate,
      routinesCount: routines.length,
      routines,
      goals,
      whatsappMessage,
    })
  } catch (err: any) {
    console.error('[whatsapp-daily-agenda] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const isAuthed = await authenticateCaller(request)
  if (!isAuthed) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid Bearer token or admin session.' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { action, routineId } = body

    if (action === 'mark_routine_executed' && routineId) {
      const db = getWorkspaceAdminDb()
      const { error } = await db
        .from('v2_client_routines')
        .update({
          last_executed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', routineId)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ ok: true, routineId, status: 'marked_executed' })
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  } catch (err: any) {
    console.error('[whatsapp-daily-agenda] POST Error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
