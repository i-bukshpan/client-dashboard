import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { calendarEventUpdateSchema } from '@/lib/v2/calendar-schema'
import {
  deleteWorkspaceCalendarEvent,
  updateWorkspaceCalendarEvent,
} from '@/lib/v2/google-calendar'
import {
  getWorkspaceClient,
  getWorkspaceErrorStatus,
  requireWorkspaceAdmin,
} from '@/lib/v2/workspace-dal'

const EventIdSchema = z.string().trim().min(1).max(1_024)

function calendarErrorResponse(error: unknown) {
  const candidate = error as { code?: unknown; response?: { status?: unknown } }
  const googleStatus = Number(candidate.response?.status ?? candidate.code)
  const status = googleStatus === 412 ? 409 : getWorkspaceErrorStatus(error)
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Calendar request failed' },
    { status }
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    await requireWorkspaceAdmin()
    const eventId = EventIdSchema.parse((await params).eventId)
    const parsed = calendarEventUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'פרטי הפגישה אינם תקינים' }, { status: 400 })
    }
    const { etag, ...input } = parsed.data
    if (input.clientId) await getWorkspaceClient(input.clientId)
    const event = await updateWorkspaceCalendarEvent(eventId, input, etag)
    return NextResponse.json({ event })
  } catch (error: unknown) {
    return calendarErrorResponse(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    await requireWorkspaceAdmin()
    const eventId = EventIdSchema.parse((await params).eventId)
    const etag = request.nextUrl.searchParams.get('etag') || undefined
    await deleteWorkspaceCalendarEvent(eventId, etag)
    return new NextResponse(null, { status: 204 })
  } catch (error: unknown) {
    return calendarErrorResponse(error)
  }
}
