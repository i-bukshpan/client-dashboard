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
import { getWorkspaceClient, getWorkspaceErrorStatus, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'
import { getLatestNeedsInputBrief, resolveMonthlyBriefFromChat } from '@/lib/v2/monthly-brief'
import { clientContextSchema } from '@/lib/v2/client-context-schema'
import { saveClientContext } from '@/lib/v2/client-context'
import { getClientLivingMemory, formatLivingMemoryForPrompt } from '@/lib/v2/agent-memory'
import {
  makeGetSpreadsheetInfoTool,
  makeReadSheetDataTool,
  makeAppendRowTool,
  makeCreateNewSheetStructureTool,
  makeCreateClientDriveFolderTool,
  makeUpdateDashboardLayoutTool,
  makeGetCurrentDashboardLayoutTool,
  makeGetDriveFilesTool,
  makeRememberClientFactTool,
  makeGetClientLivingMemoryTool,
  makeUpdateClientProfileTool,
  makeSearchClientEmailsTool,
  makeGetEmailThreadDetailsTool,
  makeSendOrReplyEmailTool,
  makeGetClientTasksTool,
  makeCreateOrUpdateTaskTool,
  makeGetClientCalendarEventsTool,
  makeScheduleCalendarMeetingTool,
  makeSearchClientDocumentsTool,
  makeCrossSystemStatusCheckTool,
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

  return `אתה "Nehemiah AI" - עוזר ניהולי בכיר, אקטיבי ואינטליגנטי (Executive Secretary / J.A.R.V.I.S) במערכת "Nehemiah OS".
אתה מדבר עם נחמיה, מנהל המשרד.
היום: ${today}

## אפיון ראשוני - לקוח חדש: ${client.name}

זוהי פגישת ההיכרות הראשונה עם הלקוח ${client.name}.
המשימה שלך: ניהול שיחת גילוי מובנית, מקצועית ואנושית לבניית פרופיל עסקי מלא ומיפוי לשוניות הגיליון.

### עקרונות השיחה:
- שאל שאלה אחת או שתיים בכל פנייה - לא יותר.
- היה חברותי, מקצועי, חד וענייני.
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
- לאחר שמירת ההקשר, כל שאר כלי הגיליון, המיילים, המשימות והדשבורד יהיו זמינים אוטומטית.`.trim()
}

function buildOperationalSystemPrompt(
  client: {
    id: string
    name: string
    google_sheet_id: string | null
    drive_folder_id: string | null
    gmail_label?: string | null
    advisory_goal?: string | null
    risk_level?: string | null
    portfolio_value?: number | null
    client_context_json: Record<string, unknown>
  },
  briefContext = '',
  livingMemorySection = ''
): string {
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
    `## פרופיל עסקי מאומת - ${client.name}`,
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
    ctx.notes ? `**הערות כלליות:** ${ctx.notes}` : null,
  ].filter(Boolean).join('\n')

  const clientBasicContext = [
    client.advisory_goal ? `מטרת ייעוץ: ${client.advisory_goal}` : null,
    client.risk_level ? `רמת סיכון: ${client.risk_level}` : null,
    client.portfolio_value ? `שווי תיק: ₪${client.portfolio_value.toLocaleString()}` : null,
    `גיליון Google Sheets: ${client.google_sheet_id ? `מחובר (${client.google_sheet_id})` : 'לא הוגדר עדיין'}`,
    `תיקיית Drive: ${client.drive_folder_id ? 'מחוברת' : 'לא הוגדרה'}`,
    `תווית Gmail: ${client.gmail_label ? `תווית מסונכרנת: "${client.gmail_label}"` : 'לפי כתובת אימייל'}`,
  ].filter(Boolean).join('\n')

  return `אתה "Nehemiah AI" - עוזר ניהולי בכיר, אקטיבי וכל-יודע (Executive Secretary & J.A.R.V.I.S) עבור נחמיה במערכת "Nehemiah OS".
אתה העוזר האישי והמזכיר הבכיר של נחמיה.
היום: ${today}

${contextBlock}

## פרטים טכניים וחיבורים
${clientBasicContext}

## 🧠 זיכרון חי מצטבר והחלטות קודמות (Living Memory)
${livingMemorySection}
${briefContext}

## ⚡ עקרונות הליבה של העוזר הניהולי (J.A.R.V.I.S Mode):

1. **אי-ניחוש והצלבת מקורות בזמן אמת (Omniscience & Cross-Source Retrieval):**
   כשנחמיה שואל כל שאלה על הלקוח (למשל: "מה הסטטוס של הלקוח?", "האם הגיבו על החשבונית?", "מה המשימות הפתוחות?", "מה סוכם בפגישה האחרונה?"):
   - **לעולם אל תנחש או תמציא מידע!**
   - הפעל מיד את הכלים המתאימים כדי להצליב את כל המקורות:
     * בדוק התכתבויות ומיילים אחרונים (\`search_client_emails\` / \`get_email_thread_details\`).
     * בדוק משימות דחופות ובאיחור (\`get_client_tasks\`).
     * בדוק פגישות ואירועי יומן (\`get_client_calendar_events\`).
     * קרא נתונים עדכניים מהגיליון (\`read_sheet_data\` / \`get_spreadsheet_info\`).
     * חפש במסמכי ה-Drive ודוחות OCR (\`search_client_documents\`).
     * לתמונת מצב כוללת 360°, הפעל \`cross_system_status_check\`.

2. **זיכרון חי מתמשך ולמידה אוטונומית:**
   - בכל פעם שנחמיה נותן הנחיה חדשה, מקבל החלטה, או כשאתה מגלה עובדה קריטית על הלקוח (שיעור מע"מ, סכום קבוע, שותף חדש, העדפת תקשורת, סיכום חשוב) - קרא מיד לכלי \`remember_client_fact\` כדי לקבע את המידע במסד הנתונים של הזיכרון החי.
   - אם הפרופיל העסקי הבסיסי השתנה - קרא ל-\`update_client_profile\`.

3. **פורמט מענה מנהלים מובנה וחד (Actionable Executive Format):**
   ענה תמיד בעברית מקצועית, מדויקת ומובנית. הימנע מפסקאות טקסט ארוכות ומייגעות (Wall of Text).
   מבנה התשובה המומלץ:
   - **🎯 תמונת מצב מנהלים (Executive Summary):** 1-2 משפטים חדים וממוקדים.
   - **📊 ממצאים והצלבת נתונים (Key Facts):** נקודות תבליט ברורות עם **הדגשות** למספרים, תאריכים ושמות (מיילים, משימות, יומן, גיליון).
   - **🚀 צעדים אופרטיביים מומלצים (Actionable Next Steps):** המלצות קונקרטיות לפעולה (יצירת משימה, שליחת מענה, קביעת פגישה, עדכון גיליון).

4. **אוטונומיה ויוזמה:**
   - בצע פעולות בעצמך דרך הכלים (כתיבה לגיליון, בניית דשבורד, יצירת משימות, קביעת אירועים).
   - לעולם אל תזכיר שמות של כלים טכניים בטקסט הגלוי לנחמיה (הפעל ישירות כ-Tool Calls).

## 🎯 חוקי ברזל קריטיים לבניית ועדכון דשבורד מנהלים (update_dashboard_layout):
1. **חובת ביצוע ישיר באותו התור:**
   כשנחמיה מבקש לבנות דשבורד, להוסיף ווידג'ט או לעצב מחדש את הדשבורד, או כשאתה מסכם רשימת ווידג'טים חדשה:
   - **אתה חייב לקרוא ישירות לכלי \`update_dashboard_layout\` באותו התור בדיוק!**
   - ⛔ **איסור מוחלט:** לעולם אל תגיד בטקסט בלבד "אבנה כעת את הווידג'טים" או "אני מעדכן כעת" בלי להפעיל בפועל את הכלי באותה התגובה!

2. **מעקב וכיבוד שינויים ידניים של נחמיה (Active Change Tracking):**
   - לפני דריסה, איפוס או ביצוע שינויים מבניים בדשבורד, בתצוגות או בהקשר הלקוח, **עליך תמיד לבדוק את המצב הנוכחי באמצעות \`get_current_dashboard_layout\` ולהכיר בכל שינוי ידני, סידור מותאם או ווידג'ט שנחמיה יצר או ערך בממשק הוויזואלי.**
   - שמור על ווידג'טים קיימים שנחמיה עיצב אלא אם נחמיה ביקש במפורש להחליף או למחוק אותם!

3. **גמישות מלאה והימנעות מתבניות קשיחות (Flexibility over Presets):**
   - **לעולם אל תהיה "תקוע" על תבנית ראשונית או ברירת מחדל קבועה.**
   - אם נחמיה מבקש מבנה אחר, סינון ייעודי, טאב חדש או הגדרה שונה – אמץ ושמר את המצב הנוכחי המותאם שנחמיה ביקש, ואל תשחזר תבניות גנריות.

4. **דיוק מוחלט של 100% לפי בקשת נחמיה:**
   - אם נחמיה ביקש ווידג'טים ספציפיים (לדוגמה: סה"כ חוזים כולל מע"מ מתוך 'פרויקטים', יתרת גבייה, הוצאות פרויקטים, והוצאות חברה בסינון חובה) – **בנה במדויק אך ורק את הווידג'טים האלו עם הכותרות, הלשוניות, העמודות והסינונים המדויקים שנמסרו!**
   - **שמות מדויקים מהגיליון:** העתק במדויק את שמות הלשוניות (\`sheet\`), שמות העמודות (\`column\`/\`y_column\`/\`date_column\`) והסינונים (\`filters\`) כפי שהם קיימים בגיליון.
   - **סיווג טאבים מסודר:** הצב את הווידג'טים תחת \`tab: 'ראשי'\` (או בטאב הרלוונטי שסוכם), עם כותרות בעברית תואמות (\`title\`).

5. **סכימת עמודות מרובות (Multi-Column Sum) ואי-הטרחת נחמיה:**
   - **המערכת תומכת באופן מלא בסכימת מספר עמודות בכרטיס בודד (stat_card)!** ניתן לסכם מספר עמודות בבת אחת ע"י העברת מערך \`columns: ["עמודה F", "עמודה G", "עמודה H"]\` או ע"י הפרדת שמות העמודות בפסיקים ב-\`y_column: "F, G, H"\`.
   - ⛔ **איסור מוחלט לשלוח את נחמיה לפעולות ידניות בגיליון:** לעולם אל תגיד לנחמיה "לך תוסיף עמודה בגיליון, תגרור נוסחה ותחזור אליי". אתה העוזר הניהולי – אם נדרש חישוב, השתמש ביכולת המערכת לסכם את העמודות ישירות, או בצע פעולות בעצמך!

## כלי עבודה זמינים
- **זיכרון חי:** \`remember_client_fact\`, \`get_client_living_memory\`, \`update_client_profile\`
- **אימייל ו-Gmail:** \`search_client_emails\`, \`get_email_thread_details\`, \`send_or_reply_email\`
- **משימות ותפעול:** \`get_client_tasks\`, \`create_or_update_task\`
- **יומן פגישות:** \`get_client_calendar_events\`, \`schedule_calendar_meeting\`
- **גיליון ודשבורד:** \`get_spreadsheet_info\`, \`read_sheet_data\`, \`append_row\`, \`create_new_sheet_structure\`, \`get_current_dashboard_layout\`, \`update_dashboard_layout\`
- **מסמכים ו-RAG:** \`search_client_documents\`, \`get_drive_files\`
- **סטטוס כולל 360°:** \`cross_system_status_check\``.trim()
}

function makeSaveClientContextTool(clientId: string) {
  return tool({
    description:
      'Saves the structured client onboarding context to the database. ' +
      'Call this ONLY after gathering sufficient information and Nehemiah has confirmed the summary is correct.',
    inputSchema: clientContextSchema,
    execute: async (input) => {
      try {
        await saveClientContext(clientId, input)
        return {
          success: true,
          message: 'הפרופיל העסקי של הלקוח נשמר בהצלחה! כל כלי ה-J.A.R.V.I.S, המיילים, הגיליונות והמשימות זמינים כעת.',
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
  try {
    await requireWorkspaceAdmin()
  } catch (error: unknown) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: getWorkspaceErrorStatus(error) }
    )
  }

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
    try {
      const resolution = latestUserText
        ? await resolveMonthlyBriefFromChat(clientId, latestUserText)
        : { handled: false, brief: await getLatestNeedsInputBrief(clientId) }
      const pendingBrief = resolution.brief?.state === 'needs_input' ? resolution.brief : null
      briefContext = resolution.handled
        ? resolution.brief?.state === 'needs_input'
          ? `\n## בריף חודשי - תשובתך נקלטה ועודכנה! שאלות שנותרו:\n${resolution.brief.missingInformation.map((item) => `- ${item.question} (אפשרויות: ${item.options.join(' / ')})`).join('\n')}`
          : '\n## בריף חודשי - כל השאלות הושלמו בהצלחה! הודע לנחמיה שהבריף מוכן לאישור.'
        : pendingBrief
          ? `\n## בריף חודשי במצב needs_input (ממתין למענה נחמיה):\nשאל את השאלות הבאות במידת הצורך:\n${pendingBrief.missingInformation.map((item) => `- ${item.question} (אפשרויות: ${item.options.join(' / ')})`).join('\n')}`
          : ''
    } catch (err) {
      console.warn('[chat/route] Monthly brief handling exception caught safely:', err)
    }
  }

  // Fetch living memory for the client
  let livingMemorySection = ''
  if (!discoveryMode) {
    try {
      const memories = await getClientLivingMemory(clientId, 25)
      livingMemorySection = formatLivingMemoryForPrompt(memories)
    } catch (err) {
      console.warn('[chat/route] Living memory retrieval warning:', err)
    }
  }

  const tools: ToolSet = discoveryMode
    ? {
        save_client_context: makeSaveClientContextTool(clientId),
        ...(client.google_sheet_id ? { get_spreadsheet_info: makeGetSpreadsheetInfoTool(clientId) } : {}),
      }
    : {
        // Living Memory & Profile
        remember_client_fact: makeRememberClientFactTool(clientId),
        get_client_living_memory: makeGetClientLivingMemoryTool(clientId),
        update_client_profile: makeUpdateClientProfileTool(clientId),

        // Gmail Intelligence
        search_client_emails: makeSearchClientEmailsTool(clientId),
        get_email_thread_details: makeGetEmailThreadDetailsTool(clientId),
        send_or_reply_email: makeSendOrReplyEmailTool(clientId),

        // Tasks & Operations
        get_client_tasks: makeGetClientTasksTool(clientId),
        create_or_update_task: makeCreateOrUpdateTaskTool(clientId),

        // Calendar
        get_client_calendar_events: makeGetClientCalendarEventsTool(clientId),
        schedule_calendar_meeting: makeScheduleCalendarMeetingTool(clientId),

        // Sheets & Dashboard
        get_spreadsheet_info: makeGetSpreadsheetInfoTool(clientId),
        read_sheet_data: makeReadSheetDataTool(clientId),
        append_row: makeAppendRowTool(clientId),
        create_new_sheet_structure: makeCreateNewSheetStructureTool(clientId),
        get_current_dashboard_layout: makeGetCurrentDashboardLayoutTool(clientId),
        update_dashboard_layout: makeUpdateDashboardLayoutTool(clientId),

        // Drive & Documents (RAG)
        get_drive_files: makeGetDriveFilesTool(clientId),
        create_client_drive_folder: makeCreateClientDriveFolderTool(clientId),
        search_client_documents: makeSearchClientDocumentsTool(clientId),

        // 360° Omniscience
        cross_system_status_check: makeCrossSystemStatusCheckTool(clientId),
      }

  const systemPrompt = discoveryMode
    ? buildDiscoverySystemPrompt(client)
    : buildOperationalSystemPrompt(client, briefContext, livingMemorySection)

  const modelMessages = await convertToModelMessages(messages || [])

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: systemPrompt,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(12),
    maxRetries: 2,
  })

  return result.toUIMessageStreamResponse()
}
