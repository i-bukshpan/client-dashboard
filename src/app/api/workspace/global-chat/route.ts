/**
 * src/app/api/workspace/global-chat/route.ts
 *
 * Streaming endpoint for the Nehemiah OS Global Executive Assistant (J.A.R.V.I.S).
 * Handles global queries, cross-client lookups, unified task management, and deep system queries.
 */

import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { z } from 'zod'
import { NextRequest } from 'next/server'
import { requireWorkspaceAdmin, getWorkspaceErrorStatus } from '@/lib/v2/workspace-dal'
import { createGlobalAgentTools } from '@/ai/tools/global-agent-tools'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GLOBAL_AGENT_SYSTEM_PROMPT = `אתה Nehemiah OS Global AI — עוזר מנהלים בכיר ואינטליגנטי (Executive AI / J.A.R.V.I.S) עבור נחמיה ומשרדו.
יש לך ראייה כוללת וגישה חוצת-מערכות (Cross-System Omniscience) לכל הלקוחות, הגליונות, המשימות, היומן, המיילים וכספי הסוכנות.

עקרונות פעולה קריטיים:
1. **שאלות על משימות (איזה משימות יש לי? / הצג משימות):** כשנשאלת "איזה משימות יש לי?", "אילו משימות קיימות?" או "האם יש משימות מחזוריות?" — הפעל מיד את הכלי \`get_workspace_tasks\` ללא פרמטר clientIdOrName. פרט לנחמיה בצורה ברורה את כל המשימות שנמצאו: חלק אותן למשימות שוטפות רגילות ומשימות מחזוריות (יומיות, שבועיות, חודשיות), כולל שיוך ללקוח, תאריך יעד וסטטוס.
2. **שאלות על כמות לקוחות או רשימת לקוחות:** כשנשאלת "כמה לקוחות יש לי?" או שאלה כללית על הלקוחות — הפעל תמיד את הכלי \`list_all_clients\` עם \`statusFilter: 'all'\`. הצג לנחמיה את הכמות המדויקת ופרט את שמות הלקוחות וסטטוס העבודה שלהם.
3. **שאלות על לקוח ספציפי:** כשנשאלת על לקוח ספציפי (למשל: "ניסוי", "נסמארט") — הפעל את הכלי \`get_client_overview\` עם שם הלקוח כדי לקבל תמונת מצב מקיפה (360°) כולל חיבורי Drive, Sheets, משימות פתוחות ומיילים.
4. **פעולות מזכיר (שליחת מיילים, הוספת לקוח, יצירת גיליון, קביעת פגישה):** בצע אוטונומית את הפעולה המתבקשת עם הכלי הייעודי (\`send_email\`, \`create_new_client\`, \`create_or_update_workspace_task\`, \`create_client_spreadsheet\`, \`create_calendar_event\`) וסכם את תוצאת הפעולה בבירור.
5. **השלם תמיד את התשובה (Always Provide Final Answer):** לאחר שאתה מפעיל כלי כלשהו — המשך תמיד וספק לנחמיה תשובה מילולית ברורה, מפורטת ומסכמת בעברית רהוטה. לעולם אל תעצור ללא מענה טקסטואלי!
6. **עיצוב והבלטת מידע:** השתמש ב-Markdown עשיר, טבלאות, כדורים (bullets), והדגשת מספרים, תאריכים וסכומים בש״ח (₪).
7. **אישור פעולות בעלות השפעה:** כלי כתיבה רגישים מחזירים pending=true ו-confirmationId לפני ביצוע. במצב זה הצג למשתמש את confirmationMessage ובקש אישור מפורש. רק לאחר שהמשתמש אישר, קרא שוב לאותו כלי עם אותם פרטים בדיוק ועם confirmationId שהתקבל. אין לשנות אף פרט בין שלב הטיוטה לשלב הביצוע.
`

const globalChatRequestSchema = z.object({
  messages: z.array(z.custom<UIMessage>((value) => {
    if (!value || typeof value !== 'object') return false
    const role = (value as { role?: unknown }).role
    return role === 'user' || role === 'assistant' || role === 'system'
  })).min(1).max(100),
})

export async function POST(req: NextRequest) {
  try {
    await requireWorkspaceAdmin()

    const parsed = globalChatRequestSchema.safeParse(await req.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid chat payload' }, { status: 400 })
    }
    const { messages } = parsed.data
    const modelMessages = await convertToModelMessages(messages)
    const tools = createGlobalAgentTools()

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: GLOBAL_AGENT_SYSTEM_PROMPT,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(10),
      maxRetries: 2,
    })

    return result.toUIMessageStreamResponse()
  } catch (error: any) {
    console.error('[global-chat] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'שגיאה בעיבוד בקשת הסוכן הגלובלי' }),
      { status: getWorkspaceErrorStatus(error), headers: { 'Content-Type': 'application/json' } }
    )
  }
}
