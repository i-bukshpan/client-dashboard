import { NextResponse } from 'next/server'
import { logClientActivity } from '@/lib/actions/activity-logs'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { clientId, activityType, description, metadata } = body

        if (!clientId || !activityType || !description) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const result = await logClientActivity({
            clientId,
            activityType,
            description,
            metadata
        })

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Activity API Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
