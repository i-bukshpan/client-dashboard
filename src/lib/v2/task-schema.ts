import { z } from 'zod'

const optionalDateTime = z.string().datetime({ offset: true }).nullable().optional()

export const workspaceTaskInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(10_000).nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueAt: optionalDateTime,
  reminderMinutes: z.number().int().min(0).max(40_320).optional(),
})

export const workspaceTaskUpdateSchema = workspaceTaskInputSchema.partial().extend({
  snoozedUntil: optionalDateTime,
})

export const clientWorkspaceSettingsSchema = z.object({
  clientId: z.string().uuid(),
  reminderDefaultMinutes: z.number().int().min(0).max(40_320),
  monthlyBriefEnabled: z.boolean(),
  monthlyBriefDay: z.number().int().min(1).max(28),
  monthlyBriefIncludeTasks: z.boolean(),
  monthlyBriefIncludeCalendar: z.boolean(),
  alerts: z.object({ overdueTasks: z.boolean(), upcomingTasks: z.boolean(), missingDocuments: z.boolean(), cashFlow: z.boolean() }),
})
