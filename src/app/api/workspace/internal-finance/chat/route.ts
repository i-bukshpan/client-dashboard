import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createMutationConfirmation, internalFinanceMutationDraftSchema } from '@/lib/v2/internal-finance-confirmation'
import { getInternalFinanceAgentContext, newInternalFinanceMutationId } from '@/lib/v2/internal-finance'
import { getWorkspaceErrorStatus, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const requestSchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(8_000) })).min(1).max(30),
})

const responseSchema = z.object({
  reply: z.string().min(1),
  mutation: z.object({
    operation: z.enum(['append', 'update']),
    tab: z.enum(['income', 'expenses', 'retainers', 'invoices']),
    targetId: z.string().nullable(),
    values: z.record(z.string(), z.string()),
    reason: z.string().min(2),
    summary: z.string().min(2),
  }).nullable(),
})

export async function POST(request: NextRequest) {
  try {
    await requireWorkspaceAdmin()
    const { messages } = requestSchema.parse(await request.json())
    const context = await getInternalFinanceAgentContext()
    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: responseSchema,
      system: `אתה הסוכן הפיננסי הפנימי של Nehemiah OS v2. ענה בעברית ובקצרה.
הנתונים שסופקו מגיעים מגיליון Google Sheets הפנימי והם מקור האמת היחיד.
נתח נתונים, חשב מגמות, אתר חריגות וענה על שאלות.
כאשר המשתמש מבקש להוסיף או לעדכן הכנסה, הוצאה, ריטיינר או חשבונית, החזר mutation מוצע בלבד. לעולם אל תטען שהפעולה בוצעה. הסבר שנדרש אישור מפורש בכפתור.
להוספה השתמש operation=append ו-targetId=null. לעדכון השתמש operation=update וב-targetId שהוא הערך המדויק בעמודת "מזהה" מתוך הנתונים שסופקו; values יכיל רק את השדות המשתנים.
אם חסר פרט מהותי, mutation חייב להיות null ועליך לשאול שאלה ממוקדת.
שמות העמודות המותרים:
income: מזהה, תאריך, לקוח, תיאור, סכום לפני מע״מ, מע״מ, סכום כולל, אמצעי תשלום, סטטוס, אסמכתא
expenses: מזהה, תאריך, ספק, קטגוריה, תיאור, סכום לפני מע״מ, מע״מ, סכום כולל, אמצעי תשלום, מוכר למס, אסמכתא
retainers: מזהה, לקוח, סכום חודשי, תאריך התחלה, תאריך חיוב הבא, סטטוס, חשבונית אחרונה, הערות
invoices: מזהה, מספר חשבונית, לקוח, תאריך הפקה, תאריך פירעון, סכום כולל, סטטוס, קישור למסמך, הערות
אל תמציא נתונים, לקוחות, סכומים או סטטוסים.`,
      prompt: `נתוני הסוכנות הנוכחיים:\n${JSON.stringify(context)}\n\nשיחה:\n${messages.map((message) => `${message.role}: ${message.content}`).join('\n')}`,
    })

    const mutation = result.object.mutation
    const validatedMutation = mutation ? internalFinanceMutationDraftSchema.safeParse(mutation) : null
    const pending = validatedMutation?.success
      ? await createMutationConfirmation({ id: newInternalFinanceMutationId(), ...validatedMutation.data }, mutation?.summary ?? validatedMutation.data.reason)
      : null
    const reply = mutation && !validatedMutation?.success
      ? `${result.object.reply}\n\nחסרים פרטים מהותיים להצעת הרישום. נא להשלים: ${validatedMutation?.error.issues.map((issue) => issue.message).join(', ')}`
      : result.object.reply
    return NextResponse.json({ reply, pending })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'הסוכן הפיננסי לא הצליח להשיב' },
      { status: getWorkspaceErrorStatus(error) }
    )
  }
}
