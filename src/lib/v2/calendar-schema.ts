import { z } from 'zod'

const isoDateOrDateTime = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  'Invalid date or date-time value'
)

const calendarEventBaseSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(10_000).nullable().optional(),
  location: z.string().trim().max(1_000).nullable().optional(),
  start: isoDateOrDateTime,
  end: isoDateOrDateTime,
  allDay: z.boolean().default(false),
  clientId: z.string().uuid().nullable().optional(),
  reminders: z.array(z.number().int().min(0).max(40_320)).max(5).default([30]),
  attendees: z.array(z.string().email()).max(50).default([]),
})

export const calendarEventInputSchema = calendarEventBaseSchema.superRefine((value, context) => {
  if (new Date(value.end).getTime() <= new Date(value.start).getTime()) {
    context.addIssue({
      code: 'custom',
      path: ['end'],
      message: 'Event end must be after its start',
    })
  }
})

export const calendarEventUpdateSchema = calendarEventBaseSchema.partial().extend({
  etag: z.string().max(500).optional(),
}).superRefine((value, context) => {
  if (value.start && value.end && new Date(value.end).getTime() <= new Date(value.start).getTime()) {
    context.addIssue({
      code: 'custom',
      path: ['end'],
      message: 'Event end must be after its start',
    })
  }
})

export const calendarListQuerySchema = z.object({
  timeMin: isoDateOrDateTime,
  timeMax: isoDateOrDateTime,
  clientId: z.string().uuid().optional(),
})
