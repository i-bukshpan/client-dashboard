/**
 * POST /api/internal-agent
 *
 * ה-endpoint המרכזי של סוכן ה-AI.
 * מופעל מ-n8n (ווטסאפ) ומטפל בשני מצבים:
 *
 * מצב 1 — הודעה רגילה:
 *   מזהה את המשתמש, טוען היסטוריית שיחה, מריץ לולאת Function-Calling.
 *   אם יש פעולת כתיבה — שומר ל-DB ומחזיר פורמט אינטראקטיבי ל-n8n (כפתורי כן/לא).
 *
 * מצב 2 — תשובה לפעולה ממתינה (Stateful):
 *   לפני הפעלת ה-AI, בודק ב-DB אם יש למשתמש הזה פעולה שממתינה לאישור.
 *   אם המשתמש אישר ("כן" / "מאשר"), ה-API מבצע את הפעולה מיד.
 *   אם המשתמש סירב או שלח הודעה אחרת, מבטל את ההמתנה.
 *
 * Auth: Bearer / x-api-key עם SUPABASE_SERVICE_ROLE_KEY
 */

import {
  GoogleGenerativeAI,
  type FunctionCall,
  type Part,
  type Content,
} from '@google/generative-ai'
import { NextResponse } from 'next/server'
import { resolveUserContext, type UserContext } from '@/ai/context'
import {
  getAllowedDeclarations,
  executeToolCall,
  executeConfirmedAction,
} from '@/ai/tools/index'
import { fetchSystemContext, formatSystemContext } from '@/ai/systemContext'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    'כאשר כלי מחזיר pending=true — פשוט תחזיר הודעה קצרה ושאל את המשתמש אם לאשר. המערכת כבר תייצר את הכפתורים.',
    'חשוב מאוד: לעולם אל תבקש אישור על דעת עצמך לפני שהפעלת את הכלי! תמיד הפעל את הכלי הרלוונטי מיד (למשל createAppointment), ורק כשהכלי יחזיר לך pending=true, תציג למשתמש את הודעת האישור שקיבלת מהכלי.',
    '',
    '💡 **מדריך למשתמש (Fallback Guide):**',
    'אם המשתמש שואל "מה אתה יודע לעשות", "עזרה", "מה הבוט עושה", או אם אתה לא מצליח להבין איזו פעולה הוא רוצה, שלח לו את המדריך הקצר הבא:',
    '"היי! אני העוזר האישי שלך לניהול הפורטל והמשרד. הנה כמה דברים שאני יכול לעשות עבורך:',
    '📅 **יומן ופגישות:** לקבוע, לבטל או להציג פגישות ביומן הפורטל (למשל: "קבע לי פגישה מחר ב-10 עם קבלן אינסטלציה").',
    '💰 **כספים ומאזנים:** להוסיף תשלומים, לרשום הוצאות/הכנסות, ולהציג מאזן של פרויקט, שותף או הלוואות (למשל: "מה המאזן של פרויקט X?", "הוסף תשלום לקונה Y").',
    '⏰ **התראות ואיחורים:** להציג דוח התראות על איחורים בתשלומים של קונים, הלוואות או פרויקטים (למשל: "האם יש איחורי תשלומים?").',
    '👥 **עובדים ומשימות:** לראות ולעדכן משימות של עובדי הפורטל (למשל: "אילו משימות פתוחות יש לי?").',
    'איך אפשר לעזור עכשיו?"',
    '',
    systemCtxText,
  ].join('\n')
}

// ── Helper: Format History ────────────────────────────────────────────────────

function formatHistory(history?: Array<{ role: string; text: string }>): Content[] {
  if (!history || !Array.isArray(history)) return []
  return history.map(item => ({
    role: item.role === 'model' || item.role === 'ai' ? 'model' : 'user',
    parts: [{ text: item.text }],
  }))
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
    history?: Array<{ role: string; text: string }>
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad Request', message: 'Invalid JSON body.' }, { status: 400 })
  }

  const messageText = (body.message_text || '').trim()
  const contactId = (body.contact_id || '').trim()

  if (!messageText || !contactId) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'Missing "message_text" or "contact_id".' },
      { status: 400 }
    )
  }

  const ctx = await resolveUserContext(contactId)

  if (ctx.role === 'unknown') {
    return NextResponse.json({
      reply_text: 'מצטער, המספר שלך אינו רשום במערכת. פנה למנהל לקבלת גישה.',
    })
  }

  // ── 1. בדיקת סשן: האם יש פעולה ממתינה? ─────────────────────────────────────────
  const { data: pendingAction, error: pendingError } = await db
    .from('bot_pending_actions')
    .select('*')
    .eq('phone', ctx.phone)
    .maybeSingle()

  if (pendingError) {
    console.error('[internal-agent] DB Error fetching pending action:', pendingError)
    // אנו לא עוצרים פה כדי לא לתקוע את הבוט אם הטבלה חסרה, אבל רושמים ללוג
  }

  if (pendingAction) {
    const isCancel = /^\s*(לא|no|cancel|ביטול|מבטל|0|❌)/i.test(messageText) || messageText.includes("לא מאשר")
    const isConfirm = /^\s*(כן|yes|confirm|מאשר|אישור|ok|סבבה|v|✓|✅|1)/i.test(messageText) && !isCancel

    // מוחקים את הפעולה מה-DB בכל מקרה (או שבוצע, או שבוטל, או שהמשתמש עבר נושא)
    await db.from('bot_pending_actions').delete().eq('phone', ctx.phone)

    if (isConfirm) {
      try {
        const result = await executeConfirmedAction(pendingAction.action_type, pendingAction.action_params)
        const replyText = (result as any).message || (result as any).error || 'הפעולה בוצעה.'
        return NextResponse.json({ reply_text: replyText })
      } catch (err: any) {
        console.error('[internal-agent] confirmed action error:', err)
        return NextResponse.json({ reply_text: `שגיאה בביצוע הפעולה: ${err.message}` })
      }
    } else if (isCancel) {
      return NextResponse.json({ reply_text: 'הפעולה בוטלה.' })
    }
    // אם לא 'כן' ולא 'לא', נמשיך לעבד את ההודעה כרגיל.
  }

  // ── 2. הרצת ה-AI ─────────────────────────────────────────────────────────────
  const allowedDeclarations = getAllowedDeclarations(ctx)
  if (allowedDeclarations.length === 0) {
    return NextResponse.json({ reply_text: 'אין לך הרשאות לבצע פעולות כרגע.' })
  }

  try {
    const systemCtxData = await fetchSystemContext()
    const systemCtxText = formatSystemContext(systemCtxData)

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: allowedDeclarations }],
      systemInstruction: buildSystemInstruction(ctx, systemCtxText),
    })

    const chat = model.startChat({
      history: formatHistory(body.history),
    })

    let result = await chat.sendMessage(messageText)

    // ── 3. לולאת Function-Calling ──────────────────────────────────────────────
    let rounds = 0
    let actionToSave: { type: string; params: Record<string, any> } | null = null

    while (rounds < MAX_TOOL_ROUNDS) {
      const calls: FunctionCall[] | undefined = result.response.functionCalls()
      if (!calls || calls.length === 0) break

      rounds++

      const executedCalls = await Promise.all(
        calls.map(async (call) => {
          const output = await executeToolCall(call.name, call.args as Record<string, any>, ctx)
          return { call, output }
        })
      )

      const pendingExecution = executedCalls.find(({ output }) => (output as any).pending === true && (output as any).action_type)
      if (pendingExecution) {
        actionToSave = {
          type: (pendingExecution.output as any).action_type as string,
          params: (pendingExecution.output as any).action_params as Record<string, any>,
        }
      }

      const responseParts: Part[] = executedCalls.map(({ call, output }) => {
        return {
          functionResponse: {
            name: call.name,
            response: output,
          },
        } satisfies Part
      })

      result = await chat.sendMessage(responseParts)
    }

    const replyText = result.response.text().trim() || 'מצטער, לא הצלחתי להפיק תשובה.'

    // ── 4. אם יש פעולה לשמירה -> שומר ב-DB ומחזיר JSON אינטראקטיבי ───────────
    if (actionToSave) {
      // עדכון ב-DB (upsert)
      const { error: upsertError } = await db.from('bot_pending_actions').upsert({
        phone: ctx.phone,
        action_type: actionToSave.type,
        action_params: actionToSave.params,
        created_at: new Date().toISOString()
      }, { onConflict: 'phone' })

      if (upsertError) {
        console.error('[internal-agent] DB Error saving pending action:', upsertError)
        return NextResponse.json({ reply_text: `שגיאת מערכת בשמירת הפעולה (האם הרצת את 030_bot_pending_actions.sql?): ${upsertError.message}` })
      }

      // הוספת טקסט עזר למקרה ש-n8n לא מציג את הכפתורים
      const finalReplyText = replyText + '\n\n*(כדי לאשר, כתוב "מאשר". לביטול כתוב "ביטול")*'

      return NextResponse.json({
        reply_text: finalReplyText,
        requires_interactive: true,
        interactive_message: {
          text: replyText,
          buttons: [
            { id: "confirm", title: "✅ מאשר" },
            { id: "cancel", title: "❌ ביטול" }
          ]
        }
      })
    }

    // ── 5. תשובה רגילה ──────────────────────────────────────────────────────────
    return NextResponse.json({ reply_text: replyText })
    
  } catch (err: any) {
    console.error('[internal-agent] error:', err)
    return NextResponse.json(
      { error: 'Internal agent failure', message: err?.message || String(err) },
      { status: 500 }
    )
  }
}
