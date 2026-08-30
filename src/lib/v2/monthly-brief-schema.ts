import { z } from 'zod'

export function normalizeMonth(input: string): string {
  if (!input || typeof input !== 'string') {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }
  const trimmed = input.trim()
  const match = trimmed.match(/^(\d{4})[-/.](\d{1,2})/)
  if (match) {
    const year = match[1]
    const month = String(parseInt(match[2], 10)).padStart(2, '0')
    return `${year}-${month}`
  }
  const revMatch = trimmed.match(/^(\d{1,2})[-/.](\d{4})/)
  if (revMatch) {
    const month = String(parseInt(revMatch[1], 10)).padStart(2, '0')
    const year = revMatch[2]
    return `${year}-${month}`
  }
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export const reportMonthSchema = z
  .string()
  .transform((val) => normalizeMonth(val))
  .pipe(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/))

export const missingInformationSchema = z.object({
  id: z.string().min(2).max(100),
  description: z.string().min(2).max(1_000),
  question: z.string().min(2).max(1_000),
  options: z.array(z.string().min(1).max(300)).min(2).max(3),
})

export const monthlyBriefResultSchema = z.object({
  currentStatus: z.string().min(2).max(5_000),
  completedThisMonth: z.array(z.string().min(1).max(1_000)).max(30),
  pendingActions: z.array(z.string().min(1).max(1_000)).max(30),
  missingInformation: z.array(missingInformationSchema).max(10),
})

export const briefResolutionSchema = z.object({
  answersBrief: z.boolean(),
  resolutions: z.array(z.object({
    issueId: z.string(),
    decision: z.enum(['omit', 'clarified', 'will_provide']),
    answer: z.string().min(1).max(2_000),
  })).max(10),
})
