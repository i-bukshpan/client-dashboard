import { z } from 'zod'

export const reportMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

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
