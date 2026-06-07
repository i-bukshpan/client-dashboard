/**
 * POST /api/internal-agent
 *
 * ה-endpoint המרכזי של סוכן ה-AI.
 * מופעל מ-n8n (ווטסאפ) ומטפל בשני מצבים:
 *
 * מצב 1 — הודעה רגילה:
 *   { "message_text": "מה המאזן של פרויקט X?", "contact_id": "972504XXXXXX" }
 *   → מזהה את המשתמש, מריץ לולאת Function-Calling, מחזיר תשובה.
 *   אם יש פעולת כתיבה — מחזיר pending_action לאישור ב-n8n.
 *
 * מצב 2 — אישור פעולה:
 *   { "confirmed_action": { "type": "addExpense", "params": {...} }, "contact_id": "..." }
 *   → מבצע את הפעולה ישירות ומחזיר אישור.
 *
 * Auth: Bearer / x-api-key עם SUPABASE_SERVICE_ROLE_KEY
 */

import {
  GoogleGenerativeAI,
  type FunctionCall,
  type Part,
} from '@google/generative-ai'
import { NextResponse } from 'next/server'
import { resolveUserContext, type UserContext } from '@/ai/context'
import {
  getAllowedDeclarations,
  executeToolCall,
  executeConfirmedAction,
} from '@/ai/tools/index'
import { fetchSystemContext, formatSystemContext } from '@/ai/systemContext'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

const MAX_TOOL_ROUNDS = 6

// ── Auth ───────────────────────────────────────────────────────────────────────

function checkAuth(request: Request): NextResponse | null {
  const authHeader = request.headers.get('Authorization')
  const apiKeyHeader = request.headers.get('x-api-key')

  let providedToken = ''
  if (authHeader?.startsWith('Bearer ')) providedToken = authHeader.substring(7)
  else if (authHeader) providedToken = authHeader
  else if (apiKeyHeader) providedToken = apiKeyHeader

  providedToken = providedToken.trim()
  const expectedKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

  if (!expectedKey) {
    return NextResponse.json(
      { error: 'Server configuration error', message: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' },
      { status: 500 }
    )
  }
  if (!providedToken || providedToken !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Missing or invalid API key.' },
      { status: 401 }
    )
  }
  return null
}

// ── System instruction builder ─────────────────────────────────────────────────

function buildSystemInstruction(ctx: UserContext, systemCtxText: string): string {
  const roleDescriptions: Record<string, string> = {
    admin:       'מנהל כללי של המשרד — יש לך גישה מלאה לכל המידע והפעולות.',
    moshe_admin: 'משה פרוש — מנהל פרויקטי הנדל"ן (הפורטל). יש לך גישה לכל פרטי הפרויקטים, הקונים, השותפים, העובדים וההלוואות.',
    worker:      `עובד פורטל בשם ${ctx.name || 'לא ידוע'} — אתה יכול לראות ולעדכן רק את המשימות שלך עצמך.`,
    partner:     `שותף בשם ${ctx.name || 'לא ידוע'} — אתה יכול לראות מידע רק על הפרויקטים שבהם אתה שותף.`,
    unknown:     'לא מזוהה.',
  }

  return [
    'אתה עוזר פנימי של מערכת ניהול נדל"ן ומשרד. ענה בעברית בלבד, בקצרה ובאדיבות.',
    `זהות המשתמש: ${roleDescriptions[ctx.role] || ctx.role}`,
    '',
    '📌 הגדרות חשובות:',
    '• "פורטל" = פורטל משה פרוש (פרויקטי נדל"ן)',
    '• "עובד" בהקשר פורטל = עובד של משה (moshe_workers). "עובד" בהקשר משרד = עובד כללי (tasks).',
    '• "יתרת הלוואות" = סכום ההלוואה מינוס מה ששולם חזרה — ללא חישוב ריבית!',
    '',
    'כשנדרש מידע — השתמש בכלים הזמינים ואל תמציא נתונים.',
    'כשכלי מחזיר שגיאה — הסבר בנימוס.',
    'כאשר כלי מחזיר pending=true — נסח למשתמש הודעת אישור ברורה, וסיים ב:',
    '"כדי לאשר — כתוב *כן*. לביטול — כתוב *לא*."',
    '',
    systemCtxText,
  ].join('\n')
}

// ── Main Handler ───────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authError = checkAuth(request)
  if (authError) return authError

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json(
      { error: 'Server configuration error', message: 'GOOGLE_GENERATIVE_AI_API_KEY is not configured.' },
      { status: 500 }
    )
  }

  let body: {
    message_text?: string
    contact_id?: string
    confirmed_action?: { type: string; params: Record<string, any> }
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad Request', message: 'Invalid JSON body.' }, { status: 400 })
  }

  const contactId = (body.contact_id || '').trim()
  const ctx = await resolveUserContext(contactId)

  if (ctx.role === 'unknown') {
    return NextResponse.json({
      reply_text: 'מצטער, המספר שלך אינו רשום במערכת. פנה למנהל לקבלת גישה.',
    })
  }

  // ── מצב 2: ביצוע פעולה מאושרת ────────────────────────────────────────────
  if (body.confirmed_action) {
    const { type, params } = body.confirmed_action
    try {
      const result = await executeConfirmedAction(type, params)
      const replyText = (result as any).message || (result as any).error || 'הפעולה בוצעה.'
      return NextResponse.json({ reply_text: replyText })
    } catch (err: any) {
      console.error('[internal-agent] confirmed action error:', err)
      return NextResponse.json(
        { error: 'Action execution failed', message: err?.message },
        { status: 500 }
      )
    }
  }

  // ── מצב 1: הודעה רגילה ────────────────────────────────────────────────────
  const messageText = (body.message_text || '').trim()
  if (!messageText) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'Missing "message_text" or "confirmed_action".' },
      { status: 400 }
    )
  }

  if (!contactId) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'Missing "contact_id".' },
      { status: 400 }
    )
  }

  const allowedDeclarations = getAllowedDeclarations(ctx)
  if (allowedDeclarations.length === 0) {
    return NextResponse.json({ reply_text: 'אין לך הרשאות לבצע פעולות כרגע.' })
  }

  try {
    // שולף context דינמי מה-DB (פרויקטים, עובדים, שותפים, לקוחות)
    const systemCtxData = await fetchSystemContext()
    const systemCtxText = formatSystemContext(systemCtxData)

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: allowedDeclarations }],
      systemInstruction: buildSystemInstruction(ctx, systemCtxText),
    })

    const chat = model.startChat()
    let result = await chat.sendMessage(messageText)

    // ── לולאת Function-Calling ─────────────────────────────────────────────
    let rounds = 0
    let pendingAction: { type: string; params: Record<string, any> } | null = null

    while (rounds < MAX_TOOL_ROUNDS) {
      const calls: FunctionCall[] | undefined = result.response.functionCalls()
      if (!calls || calls.length === 0) break

      rounds++

      const responseParts: Part[] = await Promise.all(
        calls.map(async (call) => {
          const output = await executeToolCall(call.name, call.args as Record<string, any>, ctx)

          if ((output as any).pending === true && (output as any).action_type) {
            pendingAction = {
              type: (output as any).action_type as string,
              params: (output as any).action_params as Record<string, any>,
            }
          }

          return {
            functionResponse: {
              name: call.name,
              response: output,
            },
          } satisfies Part
        })
      )

      result = await chat.sendMessage(responseParts)
    }

    const replyText =
      result.response.text().trim() || 'מצטער, לא הצלחתי להפיק תשובה. נסה לנסח מחדש.'

    const response: Record<string, any> = { reply_text: replyText }
    if (pendingAction) {
      response.pending_action = pendingAction
    }

    return NextResponse.json(response)
  } catch (err: any) {
    console.error('[internal-agent] error:', err)
    return NextResponse.json(
      { error: 'Internal agent failure', message: err?.message || String(err) },
      { status: 500 }
    )
  }
}
