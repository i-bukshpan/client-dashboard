/**
 * Generates an ICS calendar file string for a meeting or reminder.
 */
export interface IcsEvent {
  title: string
  description?: string
  startDate: Date
  endDate?: Date
  location?: string
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export function generateIcs(events: IcsEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Client Dashboard//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const event of events) {
    const start = event.startDate
    const end = event.endDate || new Date(start.getTime() + 60 * 60 * 1000)
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@client-dashboard`

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${uid}`)
    lines.push(`DTSTART:${formatIcsDate(start)}`)
    lines.push(`DTEND:${formatIcsDate(end)}`)
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`)
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`)
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeIcsText(event.location)}`)
    }
    lines.push(`DTSTAMP:${formatIcsDate(new Date())}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(events: IcsEvent[], filename = 'calendar.ics'): void {
  const content = generateIcs(events)
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
