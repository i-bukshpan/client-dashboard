import {
  GoogleGenerativeAI,
  SchemaType,
  type FunctionDeclaration,
  type FunctionCall,
  type Part,
} from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/internal-agent
 *
 * Endpoint של "Internal AI Agent" המופעל מ-n8n (וואטסאפ).
 * מקבל הודעת טקסט ממשתמש, מריץ לולאת Function-Calling מול Gemini,
 * מפעיל פונקציות ליבה באתר (כרגע: getProjectBalance), ומחזיר תשובה טקסטואלית מוכנה.
 *
 * גוף הבקשה (JSON):
 *   { "message_text": "מה המאזן של פרויקט רחוב הרצל?", "contact_id": "972500000000" }
 *
 * תשובה (JSON):
 *   { "reply_text": "המאזן של פרויקט רחוב הרצל הוא ₪1,250,000" }
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

// כמה סבבי Function-Calling מותר לפני שעוצרים (בלם בטיחות מפני לולאה אינסופית)
const MAX_TOOL_ROUNDS = 5

// ──────────────────────────────────────────────────────────────
// 1. הגדרת ה-Tool (Function Declaration) שחשוף ל-Gemini
// ──────────────────────────────────────────────────────────────
const getProjectBalanceDeclaration: FunctionDeclaration = {
  name: 'getProjectBalance',
  description:
    'מחזיר את המאזן הפיננסי הנוכחי (בש"ח) של פרויקט נדל"ן מסוים. ' +
    'המאזן = סך התקבולים שנגבו מקונים פחות סך ההוצאות ששולמו. ' +
    'יש להשתמש בכלי זה בכל פעם שהמשתמש שואל על יתרה / מאזן / כמה כסף יש בפרויקט.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      project: {
        type: SchemaType.STRING,
        description:
          'מזהה הפרויקט (UUID) או שם הפרויקט כפי שהמשתמש ציין אותו, למשל "רחוב הרצל 12" או "פרויקט הצפון".',
      },
    },
    required: ['project'],
  },
}

// ──────────────────────────────────────────────────────────────
// 2. מימוש בפועל של ה-Tool — שאילתת DB אמיתית מול Supabase
//    (מחזיר תמיד אובייקט פשוט שיוחזר למודל כ-functionResponse)
// ──────────────────────────────────────────────────────────────
async function getProjectBalance(args: { project?: string }): Promise<Record<string, unknown>> {
  const query = (args.project || '').trim()
  if (!query) {
    return { found: false, error: 'לא צוין שם או מזהה פרויקט.' }
  }

  // איתור הפרויקט: ניסיון לפי UUID מדויק, אחרת חיפוש לפי שם (ILIKE)
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query)

  const projectQuery = looksLikeUuid
    ? db.from('moshe_projects').select('id, name').eq('id', query).limit(1)
    : db.from('moshe_projects').select('id, name').ilike('name', `%${query}%`).limit(2)

  const { data: projects, error: projErr } = await projectQuery
  if (projErr) {
    return { found: false, error: `שגיאת מסד נתונים: ${projErr.message}` }
  }
  if (!projects || projects.length === 0) {
    return { found: false, error: `לא נמצא פרויקט בשם "${query}".` }
  }
  if (projects.length > 1) {
    return {
      found: false,
      ambiguous: true,
      error: `נמצאו כמה פרויקטים תואמים ל-"${query}". יש לדייק.`,
      candidates: projects.map((p) => p.name),
    }
  }

  const project = projects[0]

  // חישוב המאזן: תקבולים שנגבו מקונים פחות הוצאות ששולמו (תואם ל-real_balance בלוח הבקרה)
  const [{ data: buyerPayments }, { data: projectPayments }] = await Promise.all([
    db.from('moshe_buyer_payments').select('amount, is_received').eq('project_id', project.id),
    db.from('moshe_project_payments').select('amount, is_paid').eq('project_id', project.id),
  ])

  const received = (buyerPayments ?? [])
    .filter((p) => p.is_received)
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const paid = (projectPayments ?? [])
    .filter((p) => p.is_paid)
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const balance = received - paid

  return {
    found: true,
    project_name: project.name,
    balance,
    received,
    paid,
    currency: 'ILS',
    balance_formatted: '₪' + balance.toLocaleString('he-IL', { maximumFractionDigits: 0 }),
  }
}

// מיפוי שם-הכלי -> המימוש שלו (להוספת כלים נוספים בעתיד)
const toolImplementations: Record<string, (args: any) => Promise<Record<string, unknown>>> = {
  getProjectBalance,
}

// ──────────────────────────────────────────────────────────────
// Auth סלחני — תואם לשאר ה-endpoints הפנימיים (Bearer / x-api-key)
// ──────────────────────────────────────────────────────────────
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
      { error: 'Unauthorized', message: 'Missing or invalid API key (Authorization Bearer / x-api-key).' },
      { status: 401 }
    )
  }
  return null
}

// ──────────────────────────────────────────────────────────────
// 3. ה-Handler הראשי: לולאת ה-Function-Calling
// ──────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const authError = checkAuth(request)
  if (authError) return authError

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json(
      { error: 'Server configuration error', message: 'GOOGLE_GENERATIVE_AI_API_KEY is not configured.' },
      { status: 500 }
    )
  }

  // קלט
  let body: { message_text?: string; contact_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad Request', message: 'Invalid JSON body.' }, { status: 400 })
  }

  const messageText = (body.message_text || '').trim()
  const contactId = (body.contact_id || '').trim()

  if (!messageText) {
    return NextResponse.json({ error: 'Bad Request', message: 'Missing "message_text".' }, { status: 400 })
  }

  try {
    // הגדרת המודל עם הכלים וה-system instruction
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [getProjectBalanceDeclaration] }],
      systemInstruction:
        'אתה עוזר פיננסי פנימי של חברת נדל"ן, עונה בעברית בלבד, בקצרה ובאדיבות. ' +
        'כשנדרש מידע פיננסי על פרויקט — השתמש בכלים הזמינים ואל תמציא נתונים. ' +
        'אם כלי מחזיר שגיאה או שלא נמצא פרויקט, הסבר זאת למשתמש בנימוס.',
    })

    // פותחים שיחה — ה-ChatSession מנהל את ההיסטוריה (turns) אוטומטית
    const chat = model.startChat()

    // הסבב הראשון: שולחים את הודעת המשתמש
    let result = await chat.sendMessage(
      contactId ? `[contact_id: ${contactId}] ${messageText}` : messageText
    )

    // ── הלופ: כל עוד המודל מבקש להריץ פונקציות, מריצים ומחזירים תוצאות ──
    let rounds = 0
    while (rounds < MAX_TOOL_ROUNDS) {
      const calls: FunctionCall[] | undefined = result.response.functionCalls()

      // אין בקשות לכלים -> Gemini החזיר תשובה טקסטואלית סופית
      if (!calls || calls.length === 0) break

      rounds++

      // מריצים כל פונקציה שהמודל ביקש, ומרכיבים functionResponse לכל אחת
      const responseParts: Part[] = await Promise.all(
        calls.map(async (call) => {
          const impl = toolImplementations[call.name]
          const output = impl
            ? await impl(call.args as any)
            : { error: `כלי לא מוכר: ${call.name}` }

          return {
            functionResponse: {
              name: call.name,
              response: output,
            },
          } satisfies Part
        })
      )

      // שולחים את כל תוצאות הכלים חזרה למודל בסבב הבא
      result = await chat.sendMessage(responseParts)
    }

    const replyText =
      result.response.text().trim() ||
      'מצטער, לא הצלחתי להפיק תשובה. נסה לנסח מחדש.'

    return NextResponse.json({ reply_text: replyText })
  } catch (err: any) {
    console.error('[internal-agent] error:', err)
    return NextResponse.json(
      { error: 'Internal agent failure', message: err?.message || String(err) },
      { status: 500 }
    )
  }
}
