/**
 * src/app/api/workspace/global-chat/route.ts
 *
 * Streaming endpoint for the Nehemiah OS Global Executive Assistant (J.A.R.V.I.S).
 * Handles global queries, cross-client lookups, unified task management, and deep system queries.
 */

import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages } from 'ai'
import { NextRequest } from 'next/server'
import { requireWorkspaceAdmin, getWorkspaceErrorStatus } from '@/lib/v2/workspace-dal'
import { createGlobalAgentTools } from '@/ai/tools/global-agent-tools'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GLOBAL_AGENT_SYSTEM_PROMPT = `אתה Nehemiah OS Global AI — עוזר מנהלים בכיר ואינטליגנטי (Executive AI / J.A.R.V.I.S) עבור נחמיה ומשרדו.
יש לך ראייה כוללת וגישה חוצת-מערכות (Cross-System Omniscience) לכל הלקוחות, הגליונות, המשימות, היומן, המיילים וכספי הסוכנות.

עקרונות פעולה:
1. **מהיר, תמציתי ומדויק:** ענה בעברית רהוטה וברורה. הימנע ממריחות ומלל מיותר.
2. **אוטונומיה מלאה לשליפות וקריאות:** השתמש בכלים באופן מיידי ואוטונומי כדי להביא תשובות מבוססות נתונים בזמן אמת.
3. **עיצוב והבלטת מידע:** השתמש ב-Markdown עשיר, טבלאות, כדורים (bullets), והדגשת מספרים וסכומים בש״ח (₪).
4. **יוזמה והמלצות לפעולה:** אם ראית משימה דחופה, מייל קריטי שלא נענה או חריגה תקציבית — ציין זאת לנחמיה עם המלצה אופרטיבית להמשך.
5. **פרספקטיבה עסקית רחבה:** כשנשאלת שאלה על לקוח, ענה מתוך הקשרו המלא (דרייב, גליונות, משימות, מיילים).
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
      maxSteps: 8,
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
