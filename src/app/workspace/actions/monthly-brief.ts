'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { approveMonthlyBrief, generateMonthlyBrief, listMonthlyBriefs } from '@/lib/v2/monthly-brief'
import { reportMonthSchema } from '@/lib/v2/monthly-brief-schema'
import { createMonthlyBriefShare } from '@/lib/v2/monthly-brief-share'
import { requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

function errorResult(error: unknown, fallback: string) { return { error: error instanceof Error ? error.message : fallback } }

export async function generateMonthlyBriefAction(clientId: string, reportMonth: string) {
  try { await requireWorkspaceAdmin(); const month = reportMonthSchema.parse(reportMonth); const previous = (await listMonthlyBriefs(clientId)).find((brief) => brief.reportMonth === month); const brief = await generateMonthlyBrief(clientId, month, previous); revalidatePath(`/workspace/clients/${clientId}`); return { success: true as const, brief } }
  catch (error: unknown) { return errorResult(error, 'יצירת הבריף נכשלה') }
}

export async function approveMonthlyBriefAction(clientId: string, briefId: string) {
  try { await requireWorkspaceAdmin(); const id = z.string().min(8).max(100).parse(briefId); const brief = await approveMonthlyBrief(clientId, id); revalidatePath(`/workspace/clients/${clientId}`); return { success: true as const, brief } }
  catch (error: unknown) { return errorResult(error, 'אישור הבריף נכשל') }
}

export async function shareMonthlyBriefAction(clientId: string, briefId: string, expiresInDays = 30) {
  try { await requireWorkspaceAdmin(); const id = z.string().min(8).max(100).parse(briefId); const days = z.number().int().min(1).max(365).parse(expiresInDays); const brief = (await listMonthlyBriefs(clientId)).find((item) => item.id === id); if (!brief) throw new Error('הבריף לא נמצא'); const grant = await createMonthlyBriefShare({ clientId, brief, expiresAt: new Date(Date.now() + days * 86_400_000).toISOString() }); const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'; return { success: true as const, shareUrl: `${origin.replace(/\/$/, '')}/share/brief/${grant.token}`, expiresAt: grant.expiresAt } }
  catch (error: unknown) { return errorResult(error, 'שיתוף הבריף נכשלה') }
}

export async function submitBriefAnswersAction(
  clientId: string,
  briefId: string,
  answers: Array<{ issueId: string; decision: 'clarified' | 'omit' | 'will_provide'; note?: string }>
) {
  try {
    await requireWorkspaceAdmin()
    const briefs = await listMonthlyBriefs(clientId)
    const pending = briefs.find((b) => b.id === briefId)
    if (!pending) throw new Error('הבריף לא נמצא')

    const answeredAt = new Date().toISOString()
    const incomingResolutions = answers.map((a) => ({
      issueId: a.issueId,
      decision: a.decision,
      answer: a.note || '',
      answeredAt,
    }))

    const updatedPrevious = {
      ...pending,
      resolutions: [
        ...pending.resolutions.filter((r) => !incomingResolutions.some((inc) => inc.issueId === r.issueId)),
        ...incomingResolutions,
      ],
      updatedAt: answeredAt,
    }

    const updatedBrief = await generateMonthlyBrief(clientId, pending.reportMonth, updatedPrevious)
    revalidatePath(`/workspace/clients/${clientId}`)
    return { success: true as const, brief: updatedBrief }
  } catch (error: unknown) {
    return errorResult(error, 'שמירת התשובות ועדכון הבריף נכשלו')
  }
}
