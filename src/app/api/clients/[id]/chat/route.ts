/**
 * POST /api/clients/[id]/chat
 *
 * AI Agent endpoint for the Nehemiah OS v2 Workspace.
 * Uses AI SDK v6 streamText + convertToModelMessages + toUIMessageStreamResponse().
 *
 * MODES:
 *  - Discovery Mode: client_context_json is empty -> structured onboarding Q&A.
 *  - Operational Mode: client_context_json populated -> full tools + context.
 */

import { NextRequest } from 'next/server'
import { streamText, stepCountIs, convertToModelMessages, tool, type ToolSet } from 'ai'
import { google } from '@ai-sdk/google'
import { getWorkspaceClient, getWorkspaceErrorStatus } from '@/lib/v2/workspace-dal'
import { getLatestNeedsInputBrief, resolveMonthlyBriefFromChat } from '@/lib/v2/monthly-brief'
import { clientContextSchema } from '@/lib/v2/client-context-schema'
import { saveClientContext } from '@/lib/v2/client-context'
import {
  makeGetSpreadsheetInfoTool,
  makeReadSheetDataTool,
  makeAppendRowTool,
  makeCreateNewSheetStructureTool,
  makeUpdateDashboardLayoutTool,
  makeGetDriveFilesTool,
} from '@/ai/tools/worksheetTools'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isContextEmpty(raw: Record<string, unknown>): boolean {
  return !raw || Object.keys(raw).length === 0 || !('version' in raw)
}

function buildDiscoverySystemPrompt(client: { name: string; google_sheet_id: string | null }): string {
  const today = new Date().toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const sheetSection = client.google_sheet_id
    ? `
### 📑 שלב מיפוי וסיווג לשוניות הגיליון (חובה!):
ללקוח מחובר גיליון Google Sheets.
1. **הפעל אוטומטית את הכלי \`get_spreadsheet_info\`** כדי למשוך את שמות כל הלשוניות הקיימות.
2. הצג לנחמיה את רשימת הלשוניות שמצאת, ובקש ממנו לסווג אותן (או הצע סיווג ראשוני בעצמך ובקש אישור):
   - **תנועות גולמיות (rawMovementsTabs):** לשוניות של הכנסות/הוצאות שוטפות (לדוגמה: \`תנועות פרויקטים\`, \`תנועות חברה\`).
   - **לוחות וסיכומי על (dashboardSummaryTabs):** לוחות שכבר כוללים נוסחאות וחישובים מסודרים מראש (לדוגמה: \`לוח כללי\`, \`לוח פרויקטים\`).
   - **מעקבים ייעודיים (trackingTabs):** מעקבים מיוחדים (לדוגמה: \`הלוואת בעלים\`, \`הוצאות קבועות\`, \`צ'קים\`).
   - **לשוניות להתעלמות (ignoredTabs):** לשוניות טיוטה, ארכיון או כאלו שאינן רלוונטיות לדשבורד.
3. שמור את המיפוי תחת השדה \`sheetMapping\` בעת קריאה ל-\`save_client_context\`.
`
    : `
### ללא גיליון מחובר:
ללקוח אין עדיין גיליון Google Sheets. התמקד באיסוף הרקע העסקי, וציין שנבנה גיליון מותאם בהמשך.
`

  return `אתה "נחמיה AI" - עוזר עסקי אינטליגנטי בתוך מערכת "Nehemiah OS".
אתה מדבר עם נחמיה, מנהל המשרד.
היום: ${today}

## אפיון ראשוני - לקוח חדש: ${client.name}

זוהי פגישת ההיכרות הראשונה עם הלקוח ${client.name}.
המשימה שלך: ניהול שיחת גילוי מובנית, מקצועית ואנושית לבניית פרופיל עסקי מלא ומיפוי לשוניות הגיליון.

### עקרונות השיחה:
- שאל שאלה אחת או שתיים בכל פנייה - לא יותר.
- היה חברותי, מקצועי ומעניין.
- התייחס לתשובות של נחמיה בצורה חכמה עם שאלות המשך.

### מה לאסוף (לפי סדר עדיפות):
1. **מהות העסק** - מה הלקוח עושה? באיזה תחום?
2. **בעלות ושותפים** - מי הבעלים? האם יש שותפים ומנהלים מרכזיים?
3. **מה נחמיה עושה עבורם** - הנהלת חשבונות? ייעוץ פיננסי? דוחות? שכר?
4. **יעדים ומטרות** - מה חשוב לניטור ולמעקב שוטף?
5. **פרויקטים ושלבים פעילים** - האם יש פרויקטים בביצוע או מחזורי עבודה?
6. **מדדים מרכזיים** - תזרים? רווחיות? גבייה? מלאי?
${sheetSection}

### כיצד לסיים:
לאחר שאספת את המידע העסקי ומיפית את לשוניות הגיליון:
1. הצג לנחמיה סיכום קצר ומסודר (כולל סיווג הלשוניות).
2. שאל: "האם הסיכום והמיפוי מדויקים? יש משהו להוסיף או לתקן?"
3. לאחר אישור - קרא מיד ל-\`save_client_context\` עם כל הפרטים (כולל \`sheetMapping\`).
4. לאחר שמירה מוצלחת - הודע שהפרופיל והמיפוי נשמרו בהצלחה ושאל כיצד להתקדם.

### מגבלות בשלב זה:
- הכלים המותרים כעת: \`save_client_context\`${client.google_sheet_id ? ' ו-\`get_spreadsheet_info\` (בלבד לצורך זיהוי הלשוניות)' : ''}.
- לאחר שמירת ההקשר, כל שאר כלי הגיליון ועיצוב הדשבורד יהיו זמינים אוטומטית.`.trim()
}

function buildOperationalSystemPrompt(client: {
  id: string
  name: string
  google_sheet_id: string | null
  drive_folder_id: string | null
  advisory_goal?: string | null
  risk_level?: string | null
  portfolio_value?: number | null
  client_context_json: Record<string, unknown>
}, briefContext = ''): string {
  const today = new Date().toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const ctx = client.client_context_json as {
    businessType?: string
    businessDescription?: string
    stakeholders?: Array<{ name: string; role: string; notes?: string }>
    nehemiahGoals?: string[]
    activePhases?: string[]
    keyMetrics?: string[]
    sheetMapping?: {
      rawMovementsTabs?: string[]
      dashboardSummaryTabs?: string[]
      trackingTabs?: string[]
      ignoredTabs?: string[]
    }
    notes?: string
  }
  const contextBlock = [
    `## פרופיל עסקי - ${client.name}`,
    `**סוג עסק:** ${ctx.businessType ?? 'לא צוין'}`,
    `**תיאור:** ${ctx.businessDescription ?? 'לא צוין'}`,
    `**שותפים ובעלים:** ${(ctx.stakeholders ?? []).map((s) => `${s.name} (${s.role})`).join(', ') || 'לא צוין'}`,
    `**מטרות נחמיה:** ${(ctx.nehemiahGoals ?? []).join(' | ') || 'לא צוין'}`,
    `**שלבים פעילים:** ${(ctx.activePhases ?? []).join(' | ') || 'לא צוין'}`,
    `**מדדי ניטור:** ${(ctx.keyMetrics ?? []).join(' | ') || 'לא צוין'}`,
    ctx.sheetMapping ? `**מיפוי לשוניות מאומת:**
- לוחות וסיכומי על (Dashboard/Summary): ${(ctx.sheetMapping.dashboardSummaryTabs ?? []).join(', ') || 'אין'}
- תנועות גולמיות (Raw Movements): ${(ctx.sheetMapping.rawMovementsTabs ?? []).join(', ') || 'אין'}
- מעקבים ייעודיים (Tracking): ${(ctx.sheetMapping.trackingTabs ?? []).join(', ') || 'אין'}
- לשוניות להתעלמות (Ignored): ${(ctx.sheetMapping.ignoredTabs ?? []).join(', ') || 'אין'}` : null,
    ctx.notes ? `**הערות:** ${ctx.notes}` : null,
  ].filter(Boolean).join('\n')

  const clientBasicContext = [
    client.advisory_goal ? `מטרת ייעוץ: ${client.advisory_goal}` : null,
    client.risk_level ? `רמת סיכון: ${client.risk_level}` : null,
    client.portfolio_value ? `שווי תיק: &#8362;${client.portfolio_value.toLocaleString()}` : null,
    `גיליון Google Sheets: ${client.google_sheet_id ? `מחובר (ID: ${client.google_sheet_id})` : 'לא הוגדר עדיין'}`,
    `תיקיית Drive: ${client.drive_folder_id ? 'מחוברת' : 'לא הוגדרה'}`,
  ].filter(Boolean).join('\n')

  const sheetInstructions = !client.google_sheet_id
    ? `## הגיליון לא הוגדר עדיין\nכעת שיש לך פרופיל עסקי מלא, שאל נחמיה אם ברצונו ליצור גיליון מותאם לפי מה שאתה יודע על העסק.`
    : `## גיליון מחובר - הנחיות עבודה חכמות:
**חוק קריטי לגבי היררכיית קריאת נתונים:**
1. **עבור סיכומי על, מדדי מפתח ובניית דשבורד מרכזי:** **העדף תמיד לקרוא מלשוניות הסיכום והלוחות המוכנים (${(ctx.sheetMapping?.dashboardSummaryTabs ?? []).join(', ') || 'כגון לוח כללי'})** שבהן הנתונים כבר מסוכמים, מאומתים ומחושבים, במקום לבצע פילטור ידני מורכב על אלפי שורות גולמיות!
2. **עבור ירידה לפרטים ופירוט תנועות:** השתמש בלשוניות התנועות הגולמיות (${(ctx.sheetMapping?.rawMovementsTabs ?? []).join(', ') || 'תנועות'}).
3. **עבור נושאים ספציפיים (כגון הלוואות בעלים):** קרא מלשוניות המעקב הייעודיות (${(ctx.sheetMapping?.trackingTabs ?? []).join(', ') || 'מעקב'}).
4. **לשוניות להתעלמות:** דלג לחלוטין על: ${(ctx.sheetMapping?.ignoredTabs ?? []).join(', ') || 'אין'}.`

  return `אתה "נחמיה AI" - עוזר עסקי אינטליגנטי ויועץ פיננסי בכיר בתוך מערכת "Nehemiah OS".
היום: ${today}

${contextBlock}

## פרטים נוספים
${clientBasicContext}
${briefContext}
${sheetInstructions}

## כללי עבודה
- תענה תמיד בעברית.
- היה יזום, מהיר ואוטונומי.
- לעולם אל תכתוב שמות כלים בטקסט - הפעל ישירות כ-Tool Call.
- **כללי עיצוב דשבורד מנהלים (update_dashboard_layout):**
  - **חובה לחלק לטאבים ברורים באמצעות שדה \`tab\` בכל ווידג'ט:**
    1. \`tab: 'ראשי'\` (Executive Overview): כרטיסי מדד עליונים בשורה 0 (הכנסות, הוצאות, רווח נקי, חוזים), תרשים מגמת תזרים לאורך זמן, וטבלת סיכום מובילים.
    2. \`tab: 'פעילות'\` (או \`פרויקטים\`): תרשים עמודות מסודר וממוין של רווחיות/הכנסות פר פרויקט/לקוח/יחידה, וטבלת נתוני פעילות מלאה.
    3. \`tab: 'הוצאות'\`: פירוט הוצאות קבועות, תקורה ותנועות חברה.
    4. \`tab: 'מעקבים'\` (או \`שותפים והלוואות\`): הלוואות בעלים, משיכות, צ'קים או מעקבים ייעודיים.
  - **קריאות ואיכות נתונים:** קרא מדדים עליונים מתוך לשוניות סיכום מוכנות כדי למנוע ערכי 0 או צורך בסינון ידני. וודא שבגרפים שדה X ושדה Y מוגדרים נכון וחד-משמעיים.
  - כשנחמיה מאשר בניית דשבורד - הפעל מיד update_dashboard_layout באותו התור.

## פרוטוקול עבודה מודולרי
1. שלב א' - get_spreadsheet_info + הצג תוכנית עבודה.
2. שלב ב' - קרא 2-3 לשוניות (בעדיפות ללשוניות סיכום), ספק סיכום ממוקד.
3. שלב ג' - הצלב נתונים + הפק בריף עסקי ופיננסי מלא.
4. שלב ד' - 2-3 שאלות חדות על נקודות שדורשות חידוד.
5. שלב ה' - הפעל update_dashboard_layout עם חלוקה לטאבים לפי הכללים לעיל.

## כלים זמינים
- get_spreadsheet_info - מגלה לשוניות בגיליון
- read_sheet_data - קורא נתונים מלשונית
- update_dashboard_layout - בונה ומעדכן דשבורד
- append_row - מוסיף שורה לגיליון
- create_new_sheet_structure - יוצר גיליון חדש
- get_drive_files - רשימת קבצים ב-Drive`.trim()
}

function makeSaveClientContextTool(clientId: string) {
  return tool({
    description:
      'Saves the structured client onboarding context to the database. ' +
      'Call this ONLY after gathering sufficient information and Nehemiah has confirmed the summary is correct. ' +
      'After a successful save, all Google Sheets tools become available for this client.',
    inputSchema: clientContextSchema,
    execute: async (input) => {
      try {
        await saveClientContext(clientId, input)
        return {
          success: true,
          message: 'הפרופיל העסקי של הלקוח נשמר בהצלחה! מעכשיו ניתן לנתח את הגיליון, לבנות דשבורד ולייצר בריפים חכמים.',
        }
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'שמירת ההקשר נכשלה' }
      }
    },
  })
}

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

  const discoveryMode = isContextEmpty(client.client_context_json)
  const { messages } = await request.json()
  const latestUser = [...(Array.isArray(messages) ? messages : [])].reverse().find((message: unknown) => {
    return typeof message === 'object' && message !== null && (message as { role?: unknown }).role === 'user'
  }) as { parts?: Array<{ type?: string; text?: string }>; content?: string } | undefined
  const latestUserText = latestUser?.parts?.filter((part) => part.type === 'text').map((part) => part.text ?? '').join(' ').trim() || latestUser?.content?.trim() || ''

  let briefContext = ''
  if (!discoveryMode) {
    const resolution = latestUserText
      ? await resolveMonthlyBriefFromChat(clientId, latestUserText)
      : { handled: false, brief: await getLatestNeedsInputBrief(clientId) }
    const pendingBrief = resolution.brief?.state === 'needs_input' ? resolution.brief : null
    briefContext = resolution.handled
      ? resolution.brief?.state === 'needs_input'
        ? `\n## בריף חודשי - תשובה נקלטה אך עדיין חסר מידע\n${resolution.brief.missingInformation.map((item) => `- ${item.question} אפשרויות: ${item.options.join(' / ')}`).join('\n')}`
        : '\n## בריף חודשי - הושלם. הודע שהמידע נקלט ושהבריף ממתין לאישור.'
      : pendingBrief
        ? `\n## בריף חודשי במצב needs_input\nשאל את השאלות הבאות:\n${pendingBrief.missingInformation.map((item) => `- ${item.question} אפשרויות: ${item.options.join(' / ')}`).join('\n')}`
        : ''
  }

  const tools: ToolSet = discoveryMode
    ? {
        save_client_context: makeSaveClientContextTool(clientId),
        ...(client.google_sheet_id ? { get_spreadsheet_info: makeGetSpreadsheetInfoTool(clientId) } : {}),
      }
    : {
        get_spreadsheet_info: makeGetSpreadsheetInfoTool(clientId),
        read_sheet_data: makeReadSheetDataTool(clientId),
        append_row: makeAppendRowTool(clientId),
        create_new_sheet_structure: makeCreateNewSheetStructureTool(clientId),
        update_dashboard_layout: makeUpdateDashboardLayoutTool(clientId),
        get_drive_files: makeGetDriveFilesTool(clientId),
      }

  const systemPrompt = discoveryMode
    ? buildDiscoverySystemPrompt(client)
    : buildOperationalSystemPrompt(client, briefContext)

  const modelMessages = await convertToModelMessages(messages || [])

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: systemPrompt,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(10),
    maxRetries: 2,
  })

  return result.toUIMessageStreamResponse()
}