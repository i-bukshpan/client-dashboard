import { NextRequest, NextResponse } from 'next/server'
import {
  calendarEventInputSchema,
  calendarListQuerySchema,
} from '@/lib/v2/calendar-schema'
import {
  createWorkspaceCalendarEvent,
  listWorkspaceCalendarEvents,
} from '@/lib/v2/google-calendar'
import {
  getWorkspaceClient,
  getWorkspaceErrorStatus,
  requireWorkspaceAdmin,
} from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'

function calendarErrorResponse(error: unknown) {
  const status = getWorkspaceErrorStatus(error)
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Calendar request failed' },
    { status }
  )
}

export async function GET(request: NextRequest) {
  try {
    await requireWorkspaceAdmin()
    const parsed = calendarListQuerySchema.safeParse({
      timeMin: request.nextUrl.searchParams.get('timeMin'),
      timeMax: request.nextUrl.searchParams.get('timeMax'),
      clientId: request.nextUrl.searchParams.get('clientId') || undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: 'טווח התאריכים אינו תקין' }, { status: 400 })
    }
    if (parsed.data.clientId) await getWorkspaceClient(parsed.data.clientId)
    return NextResponse.json(await listWorkspaceCalendarEvents(parsed.data))
  } catch (error: unknown) {
    return calendarErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireWorkspaceAdmin()
    const parsed = calendarEventInputSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'פרטי הפגישה אינם תקינים', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    if (parsed.data.clientId) await getWorkspaceClient(parsed.data.clientId)
    const event = await createWorkspaceCalendarEvent(parsed.data)
    return NextResponse.json({ event }, { status: 201 })
  } catch (error: unknown) {
    return calendarErrorResponse(error)
  }
}
