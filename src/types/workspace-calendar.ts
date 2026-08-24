export interface WorkspaceCalendarEvent {
  id: string
  etag: string | null
  title: string
  description: string | null
  location: string | null
  start: string
  end: string
  allDay: boolean
  status: 'confirmed' | 'tentative' | 'cancelled'
  htmlLink: string | null
  clientId: string | null
  reminders: number[]
  attendees: string[]
  recurringEventId: string | null
  updatedAt: string | null
}

export interface WorkspaceCalendarEventInput {
  title: string
  description?: string | null
  location?: string | null
  start: string
  end: string
  allDay?: boolean
  clientId?: string | null
  reminders?: number[]
  attendees?: string[]
}

export interface WorkspaceCalendarListResult {
  events: WorkspaceCalendarEvent[]
  nextSyncToken: string | null
}
