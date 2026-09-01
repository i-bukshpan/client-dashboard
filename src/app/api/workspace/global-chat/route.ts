/**
 * src/app/api/workspace/global-chat/route.ts
 *
 * Streaming endpoint for the Nehemiah OS Global Executive Assistant (J.A.R.V.I.S).
 * Handles global queries, cross-client lookups, unified task management, and deep system queries.
 */

import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages, stepCountIs } from 'ai'
import { NextRequest } from 'next/server'
import { requireWorkspaceAdmin, getWorkspaceErrorStatus } from '@/lib/v2/workspace-dal'
import { createGlobalAgentTools } from '@/ai/tools/global-agent-tools'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GLOBAL_AGENT_SYSTEM_PROMPT = `אתה Nehemiah OS Global AI — עוזר מנהלים בכיר ואינטליגנטי (Executive AI / J.A.R.V.I.S) עבור נחמיה ומשרדו.
יש לך ראייה כוללת וגישה חוצת-מערכות (Cross-System Omniscience) לכל הלקוחות, הגליונות, המשימות, היומן, המיילים וכספי הסוכנות.

עקרונות פעולה קריטיים:
1. **שאלות על כמות לקוחות או רשימת לקוחות:** כשנשאלת "כמה לקוחות יש לי?" או שאלה כללית על הלקוחות — הפעל תמיד את הכלי \`list_all_clients\` עם \`statusFilter: 'all'\`. הצג לנחמיה את הכמות המדויקת ופרט את שמות הלקוחות וסטטוס העבודה שלהם.
2. **שאלות על לקוח ספציפי:** כשנשאלת על לקוח ספציפי (למשל: "ניסוי", "נסמארט") — הפעל את הכלי \`get_client_overview\` עם שם הלקוח כדי לקבל תמונת מצב מקיפה (360°) כולל חיבורי Drive, Sheets, משימות פתוחות ומיילים.
3. **השלם תמיד את התשובה (Always Provide Final Answer):** לאחר שאתה מפעיל כלי כלשהו — המשך תמיד וספק לנחמיה תשובה מילולית ברורה, מפורטת ומסכמת בעברית רהוטה. לעולם אל תעצור ללא מענה טקסטואלי!
4. **אוטונומיה מלאה לשליפות ופעולות:** השתמש בכלים המתאימים מיד, שלוף את הנתונים, סכם אותם והצג את המסקנות.
5. **עיצוב והבלטת מידע:** השתמש ב-Markdown עשיר, טבלאות, כדורים (bullets), והדגשת מספרים, תאריכים וסכומים בש״ח (₪).
`

export async function POST(req: NextRequest) {
  try {
    await requireWorkspaceAdmin()

    const { messages } = await req.json()
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
