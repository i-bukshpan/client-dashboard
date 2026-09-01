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
1. **השלם תמיד את התשובה (Always Provide Final Answer):** לאחר שאתה מפעיל כלי כלשהו (שליפת לקוחות, חיפוש מיילים, יצירת משימה וכו') — המשך תמיד וספק לנחמיה תשובה מילולית ברורה, מפורטת ומסכמת בעברית רהוטה. לעולם אל תעצור לאחר קריאת כלי ללא מענה טקסטואלי!
2. **אוטונומיה מלאה לשליפות ופעולות:** השתמש בכלים המתאימים מיד, שלוף את הנתונים, סכם אותם והצג את המסקנות.
3. **עיצוב והבלטת מידע:** השתמש ב-Markdown עשיר, טבלאות, כדורים (bullets), והדגשת מספרים, תאריכים וסכומים בש״ח (₪).
4. **יוזמה והמלצות:** אם ראית משימה דחופה, מייל קריטי שלא נענה או חריגה תקציבית — ציין זאת לנחמיה עם המלצה אופרטיבית להמשך.
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
