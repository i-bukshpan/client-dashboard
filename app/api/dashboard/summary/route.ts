import { supabase } from '@/lib/supabase'

export async function GET() {
    const { data: meetings } = await supabase.from('meeting_logs').select('id, meeting_date')
    const { data: reminders } = await supabase.from('reminders').select('id, due_date, is_completed')

    const now = new Date().toDateString()
    
    const meetingsCount = meetings?.filter((m: any) => 
        new Date(m.meeting_date).toDateString() === now
    ).length || 0
    
    const tasksCount = reminders?.filter((t: any) => 
        new Date(t.due_date).toDateString() === now && !t.is_completed
    ).length || 0

    const overdueCount = reminders?.filter((t: any) => 
        new Date(t.due_date) < new Date() && !t.is_completed
    ).length || 0

    return Response.json({
        data: {
            meetingsCount,
            tasksCount,
            overdueCount
        }
    })
}
