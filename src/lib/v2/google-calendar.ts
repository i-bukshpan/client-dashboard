import 'server-only'

import type { calendar_v3 } from 'googleapis'
import { createV2CalendarClient } from '@/lib/v2/google-auth'
import type {
  WorkspaceCalendarEvent,
  WorkspaceCalendarEventInput,
  WorkspaceCalendarListResult,
} from '@/types/workspace-calendar'

const TIME_ZONE = 'Asia/Jerusalem'
const MANAGED_KEY = 'nehemiahManaged'
const CLIENT_KEY = 'clientId'

function calendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID || 'primary'
}

function toEvent(resource: calendar_v3.Schema$Event): WorkspaceCalendarEvent | null {
  if (!resource.id || !resource.start || !resource.end) return null
  const allDay = Boolean(resource.start.date)
  const start = resource.start.dateTime ?? resource.start.date
  const end = resource.end.dateTime ?? resource.end.date
  if (!start || !end) return null

  return {
    id: resource.id,
    etag: resource.etag ?? null,
    title: resource.summary ?? 'פגישה ללא כותרת',
    description: resource.description ?? null,
    location: resource.location ?? null,
    start,
    end,
    allDay,
    status: resource.status === 'tentative' || resource.status === 'cancelled'
      ? resource.status
      : 'confirmed',
    htmlLink: resource.htmlLink ?? null,
    clientId: resource.extendedProperties?.private?.[CLIENT_KEY] ?? null,
    reminders: (resource.reminders?.overrides ?? [])
      .filter((reminder) => reminder.method === 'popup' && typeof reminder.minutes === 'number')
      .map((reminder) => reminder.minutes as number),
    attendees: (resource.attendees ?? [])
      .map((attendee) => attendee.email)
      .filter((email): email is string => Boolean(email)),
    recurringEventId: resource.recurringEventId ?? null,
    updatedAt: resource.updated ?? null,
  }
}

function toRequestBody(input: WorkspaceCalendarEventInput): calendar_v3.Schema$Event {
  const start = input.allDay
    ? { date: input.start.slice(0, 10) }
    : { dateTime: input.start, timeZone: TIME_ZONE }
  const end = input.allDay
    ? { date: input.end.slice(0, 10) }
    : { dateTime: input.end, timeZone: TIME_ZONE }

  return {
    summary: input.title,
    description: input.description || undefined,
    location: input.location || undefined,
    start,
    end,
    attendees: input.attendees?.map((email) => ({ email })),
    reminders: {
      useDefault: false,
      overrides: (input.reminders ?? [30]).map((minutes) => ({ method: 'popup', minutes })),
    },
    extendedProperties: {
      private: {
        [MANAGED_KEY]: 'true',
        ...(input.clientId ? { [CLIENT_KEY]: input.clientId } : {}),
        schemaVersion: '1',
      },
    },
  }
}

export async function listWorkspaceCalendarEvents(input: {
  timeMin: string
  timeMax: string
  clientId?: string
}): Promise<WorkspaceCalendarListResult> {
  const calendar = createV2CalendarClient()
  const events: WorkspaceCalendarEvent[] = []
  let pageToken: string | undefined
  let nextSyncToken: string | null = null

  do {
    const response = await calendar.events.list({
      calendarId: calendarId(),
      timeMin: input.timeMin,
      timeMax: input.timeMax,
      singleEvents: true,
      showDeleted: false,
      orderBy: 'startTime',
      maxResults: 500,
      pageToken,
      ...(input.clientId
        ? { privateExtendedProperty: [`${CLIENT_KEY}=${input.clientId}`] }
        : {}),
    })
    for (const resource of response.data.items ?? []) {
      const event = toEvent(resource)
      if (event) events.push(event)
    }
    pageToken = response.data.nextPageToken ?? undefined
    nextSyncToken = response.data.nextSyncToken ?? nextSyncToken
  } while (pageToken)

  return { events, nextSyncToken }
}

export async function createWorkspaceCalendarEvent(
  input: WorkspaceCalendarEventInput
): Promise<WorkspaceCalendarEvent> {
  const calendar = createV2CalendarClient()
  const response = await calendar.events.insert({
    calendarId: calendarId(),
    sendUpdates: input.attendees?.length ? 'all' : 'none',
    requestBody: toRequestBody(input),
  })
  const event = toEvent(response.data)
  if (!event) throw new Error('[v2/calendar] Google returned an invalid event')
  return event
}

export async function updateWorkspaceCalendarEvent(
  eventId: string,
  input: Partial<WorkspaceCalendarEventInput>,
  etag?: string
): Promise<WorkspaceCalendarEvent> {
  const calendar = createV2CalendarClient()
  const current = await calendar.events.get({ calendarId: calendarId(), eventId })
  const existing = toEvent(current.data)
  if (!existing) throw new Error('[v2/calendar] Event not found')

  const merged: WorkspaceCalendarEventInput = {
    title: input.title ?? existing.title,
    description: input.description === undefined ? existing.description : input.description,
    location: input.location === undefined ? existing.location : input.location,
    start: input.start ?? existing.start,
    end: input.end ?? existing.end,
    allDay: input.allDay ?? existing.allDay,
    clientId: input.clientId === undefined ? existing.clientId : input.clientId,
    reminders: input.reminders ?? existing.reminders,
    attendees: input.attendees ?? existing.attendees,
  }

  const response = await calendar.events.update(
    {
      calendarId: calendarId(),
      eventId,
      sendUpdates: merged.attendees?.length ? 'all' : 'none',
      requestBody: toRequestBody(merged),
    },
    etag ? { headers: { 'If-Match': etag } } : undefined
  )
  const event = toEvent(response.data)
  if (!event) throw new Error('[v2/calendar] Google returned an invalid event')
  return event
}

export async function deleteWorkspaceCalendarEvent(eventId: string, etag?: string): Promise<void> {
  const calendar = createV2CalendarClient()
  await calendar.events.delete(
    { calendarId: calendarId(), eventId, sendUpdates: 'all' },
    etag ? { headers: { 'If-Match': etag } } : undefined
  )
}
