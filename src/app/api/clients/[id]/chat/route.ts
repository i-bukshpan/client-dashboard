/**
 * POST /api/clients/[id]/chat
 *
 * AI Agent endpoint for the Nehemiah OS v2 Workspace.
 * Uses AI SDK v6 streamText + convertToModelMessages + toUIMessageStreamResponse().
 */

import { NextRequest } from 'next/server'
import { streamText, stepCountIs, convertToModelMessages } from 'ai'
import { google } from '@ai-sdk/google'
import { getWorkspaceClient, getWorkspaceErrorStatus } from '@/lib/v2/workspace-dal'
import { getLatestNeedsInputBrief, resolveMonthlyBriefFromChat } from '@/lib/v2/monthly-brief'
import {
  makeGetSpreadsheetInfoTool,
  makeReadSheetDataTool,
  makeAppendRowTool,
  makeCreateNewSheetStructureTool,
  makeUpdateDashboardLayoutTool,
  makeGetDriveFilesTool,
} from '@/ai/tools/worksheetTools'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // seconds — allow time for multi-step tool calls

// ── System prompt factory ──────────────────────────────────────────────────────

function buildSystemPrompt(client: {
  id: string
  name: string
  google_sheet_id: string | null
  drive_folder_id: string | null
  advisory_goal?: string | null
  risk_level?: string | null
  portfolio_value?: number | null
}, briefContext = '') {
  const today = new Date().toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const clientContext = [
    `שם הלקוח: ${client.name}`,
    client.advisory_goal ? `מטרת ייעוץ: ${client.advisory_goal}` : null,
    client.risk_level ? `רמת סיכון: ${client.risk_level}` : null,
    client.portfolio_value ? `שווי תיק: ₪${client.portfolio_value.toLocaleString()}` : null,
    `גיליון Google Sheets: ${client.google_sheet_id ? `מחובר (ID: ${client.google_sheet_id})` : 'לא הוגדר עדיין'}`,
    `תיקיית Drive: ${client.drive_folder_id ? 'מחוברת' : 'לא הוגדרה'}`,
  ]
    .filter(Boolean)
    .join('\n')

  const sheetSetupInstructions = !client.google_sheet_id
    ? `
## 🔴 משימה מיידית — הגיליון לא הוגדר עדיין

ללקוח ${client.name} אין עדיין גיליון Google Sheets.
עליך **לפתוח שיחה יזומה עם נחמיה** ולשאול שאלות כדי להבין:
1. מה עסק הלקוח? (ייצור? שירותים? שכר? נדל"ן?)
2. מה נתוני המפתח שנחמיה רוצה לעקוב? (הכנסות? הוצאות? לקוחות? מלאי?)
3. כמה לשוניות נדרשות? מה שם כל לשונית?
4. מה העמודות בכל לשונית? (תאריך, קטגוריה, סכום, ספק, הערות...)

לאחר שנחמיה מאשר את המבנה, הצג לו סיכום ברור בטבלה, ושאל "לאשר?" לפני קריאה ל-create_new_sheet_structure.
`
    : `
## ✅ גיליון מחובר — מצב פעיל

הגיליון מוכן לשימוש.
**חוק קריטי לגבי גיליון קיים:**
כשנחמיה מבקש לנתח, לקרוא נתונים, לתת סיכום, או לבצע פעולה כלשהי בגיליון:
עליך להפעיל **מיד ובאופן אוטומטי** את הכלי \`get_spreadsheet_info\` כדי לגלות את שמות הלשוניות הקיימות!
**לעולם אל תשאל את נחמיה מה שמות הלשוניות בגיליון.** גלה אותן אוטומטית בעזרת \`get_spreadsheet_info\`, ולאחר מכן קרא את הנתונים באמצעות \`read_sheet_data\`.
`

  return `
אתה "נחמיה AI" — עוזר עסקי אינטליגנטי ויועץ פיננסי בכיר בתוך מערכת "Nehemiah OS".
אתה מדבר עם נחמיה, מנהל המשרד, ומסייע לו בניהול לקוחות.
היום: ${today}

## פרופיל הלקוח הנוכחי
${clientContext}
${briefContext}
${sheetSetupInstructions}

## כללי עבודה
- תענה **תמיד בעברית** אלא אם נשאל מפורשות בשפה אחרת.
- היה יזום, מהיר ואוטונומי לחלוטין.
- **הוראה קריטית ביותר לגבי הפעלת כלים:**
  - יש לך כלים פונקציונליים מובנים (Native Function Calling).
  - **לעולם אל תכתוב בטקסט** משפטים כמו "הנה קריאת הפונקציה לבניית הדשבורד" או "מפעיל את הכלי update_dashboard_layout כעת" או שמות של כלים בטקסט!
  - **במקום לכתוב טקסט מקדים — הפעל מיד את הפונקציה (Function Call)!**
- **בנייה ועדכון דשבורד (update_dashboard_layout):**
  - כשנחמיה מבקש לבנות דשבורד, או מאשר הצעה (למשל כותב 'ההצעה בסדר', 'בנה את הדשבורד', 'מושלם', 'כן', 'בצע', 'סיימת?'):
    **הפעל מיד את הכלי \`update_dashboard_layout\` כ-Tool Call באותו התור בדיוק! אל תמתין ואל תכתוב טקסט במקום להפעיל!**
  - מנוע הדשבורד תומך ב:
    - **חלוקה לטאבים פנימיים בדשבורד (\`tab\`):** ניתן להגדיר שווידג'טים שייכים לטאב מסוים (למשל \`tab: 'ראשי'\`, \`tab: 'ספקים'\`, \`tab: 'סוכנים'\`, \`tab: 'משכורות'\`, \`tab: 'הזמנות'\`). הממשק יציג סרגל טאבים עליון לדפדוף מהיר!
    - **רווח נקי (Net Profit):** \`aggregation: 'net_diff'\` עם \`net_formula\` (הכנסות פחות הוצאות).
    - **סה״כ הכנסות:** \`filters: [{ column: 'סוג', operator: 'equals', value: 'הכנסה' }]\`.
    - **סה״כ הוצאות:** \`filters: [{ column: 'סוג', operator: 'equals', value: 'הוצאה' }]\`.
    - **גרף הכנסות/הוצאות חודשי:** \`type: 'bar_chart'\`.
    - **התפלגות לפי ספק/קטגוריה:** \`type: 'pie_chart'\`.
    - **טבלת תנועות אחרונות:** \`type: 'data_table'\`.
- כשאתה קורא נתונים (read_sheet_data), ניתח אותם ותן תובנות פיננסיות ועסקיות ברורות.
## 🧠 פרוטוקול עבודה מודולרי בשלבים עוקבים (Phased Incremental Execution Protocol)
כדי למנוע תקיעות, עומס טוקנים ואיטיות בעיבוד גיליונות עתירי מידע ולשוניות:
1. **שלב א' — מיפוי מהיר והכרזת תוכנית עבודה קצרה:**
   - הפעל מיד את \`get_spreadsheet_info\` כדי לגלות את כל הלשוניות בגיליון.
   - הצג לנחמיה הודעת סטטוס תמציתית ומובנית, למשל:
     *"זיהיתי בגיליון X לשוניות. אני מחלק את הניתוח ל-3 שלבים ממוקדים כדי להבטיח עיבוד מהיר ומדויק:*
     *• **שלב 1:** פעילות ותנועות (תזרים, הכנסות, הוצאות ופרויקטים)*
     *• **שלב 2:** הון ושותפים (הלוואות בעלים, משיכות וחלוקות רווח)*
     *• **שלב 3:** ספקים, לקוחות והוצאות קבועות*
     *מתחיל כעת בשלב 1..."*
2. **שלב ב' — עיבוד בקבוצות מדודות (Batch Processing):**
   - קרא 2–3 לשוניות בכל פעם בעזרת \`read_sheet_data\`.
   - ספק סיכום תמציתי ומדויק של כל קבוצה לפני המעבר לקבוצה הבאה.
   - **שמור על תשובות ממוקדות וחדות** כדי שהסטרימינג יזרום במהירות ולעולם לא ייעצר באמצע.
3. **שלב ג' — הצלבת נתונים והפקת "בריף עסקי ופיננסי מלא" (Client Intelligence Brief):**
   - **תחום ומהות העסק:** מה הלקוח עושה בדיוק? (לדוגמה: יזמות נדל"ן, פרויקטים בביצוע, שירותים, מסחר).
   - **מבנה שותפויות ובעלות:** מי השותפים? כמה הושקע? כמה נמשך? מה יתרת הלוואות הבעלים?
   - **תמונת מצב פיננסית:** מחזור הכנסות, סך הוצאות, רווחיות פרויקטים בפועל, יתרת גבייה מלקוחות, הוצאות קבועות.
   - **תובנות והזדמנויות עסקיות:** זיהוי פרויקטים רווחיים, נקודות תורפה בתזרים או חובות פתוחים.
4. **שלב ד' — שאלות ממוקדות להשלמת התמונה:**
   - הצג לנחמיה 2-3 שאלות חדות וספציפיות על נקודות עסקיות שדורשות חידוד (חלוקת רווחים, יעדים, תנאי התקשרות).
5. **שלב ה' — בניית והפעלת דשבורד מותאם אישית:**
   - לאחר ההבנה או אישור נחמיה, הפעל ישירות את \`update_dashboard_layout\` עם חלוקה מדויקת לטאבים ווידג'טים.

## כלים זמינים
- **get_spreadsheet_info** — מגלה אוטומטית את כל הלשוניות הקיימות בגיליון
- **read_sheet_data** — קורא נתונים מלשונית ספציפית בגיליון
- **update_dashboard_layout** — בונה ומעדכן את הדשבורד הדינמי עם ווידג'טים, סינונים וחישובי רווח נקי
- **append_row** — מוסיף שורה חדשה לגיליון (באישור נחמיה)
- **create_new_sheet_structure** — יוצר גיליון חדש מאפס (רק לאחר Q&A מלא ואישור)
- **get_drive_files** — רשימת קבצים בתיקיית Drive של הלקוח
`.trim()
}

// ── Route Handler ──────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params
  let client
  try {
    client = await getWorkspaceClient(clientId)
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Request failed' }),
      { status: getWorkspaceErrorStatus(error), headers: { 'Content-Type': 'application/json' } }
    )
  }

  // 3. Parse the request body — useChat sends { messages }
  const { messages } = await request.json()
  const latestUser = [...(Array.isArray(messages) ? messages : [])].reverse().find((message: unknown) => {
    return typeof message === 'object' && message !== null && (message as { role?: unknown }).role === 'user'
  }) as { parts?: Array<{ type?: string; text?: string }>; content?: string } | undefined
  const latestUserText = latestUser?.parts?.filter((part) => part.type === 'text').map((part) => part.text ?? '').join(' ').trim() || latestUser?.content?.trim() || ''
  const resolution = latestUserText
    ? await resolveMonthlyBriefFromChat(clientId, latestUserText)
    : { handled: false, brief: await getLatestNeedsInputBrief(clientId) }
  const pendingBrief = resolution.brief?.state === 'needs_input' ? resolution.brief : null
  const briefContext = resolution.handled
    ? resolution.brief?.state === 'needs_input'
      ? `\n## בריף חודשי — תשובה נקלטה אך עדיין חסר מידע\nהודה לנחמיה על התשובה ושאל רק את השאלות שנותרו:\n${resolution.brief.missingInformation.map((item) => `- ${item.question} אפשרויות: ${item.options.join(' / ')}`).join('\n')}`
      : '\n## בריף חודשי — הושלם לאחר תשובת נחמיה\nהודע שהמידע נקלט, הבריף חודש בהצלחה וכעת ממתין לאישור בלשונית "בריף חודשי".'
    : pendingBrief
      ? `\n## בריף חודשי במצב needs_input\nיש לבקש מנחמיה תשובות מפורשות וקצרות לשאלות הבאות. אם שאל נושא אחר, ענה עליו ואז הזכר שהבריף ממתין:\n${pendingBrief.missingInformation.map((item) => `- ${item.question} אפשרויות: ${item.options.join(' / ')}`).join('\n')}`
      : ''

  // 4. Build tools scoped to this client
  const tools = {
    get_spreadsheet_info: makeGetSpreadsheetInfoTool(clientId),
    read_sheet_data: makeReadSheetDataTool(clientId),
    append_row: makeAppendRowTool(clientId),
    create_new_sheet_structure: makeCreateNewSheetStructureTool(clientId),
    update_dashboard_layout: makeUpdateDashboardLayoutTool(clientId),
    get_drive_files: makeGetDriveFilesTool(clientId),
  }

  // 5. Convert UI messages to model messages (await is required!)
  const modelMessages = await convertToModelMessages(messages || [])

  // 6. Stream the response
  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: buildSystemPrompt(client, briefContext),
    messages: modelMessages,
    tools,
    // Allow up to 10 tool-call/response cycles (multi-step reasoning)
    stopWhen: stepCountIs(10),
    maxRetries: 2,
  })

  // 7. Return the UI message stream — this is what useChat in ai@6 expects
  return result.toUIMessageStreamResponse()
}
