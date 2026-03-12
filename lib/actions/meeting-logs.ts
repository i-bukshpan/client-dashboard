'use server'

import { supabase } from '@/lib/supabase'
import type { MeetingLog } from '@/lib/supabase'

export async function createMeetingLog(data: Omit<MeetingLog, 'id' | 'created_at'>) {
    try {
        const { data: log, error } = await supabase
            .from('meeting_logs')
            .insert(data)
            .select()
            .single()

        if (error) throw error
        return { success: true, log }
    } catch (error: any) {
        console.error('Error creating meeting log:', error)
        return { success: false, error: error.message }
    }
}

export async function getMeetingLogs(clientId: string) {
    try {
        const { data: logs, error } = await supabase
            .from('meeting_logs')
            .select('*')
            .eq('client_id', clientId)
            .order('meeting_date', { ascending: false })

        if (error) throw error
        return { success: true, logs }
    } catch (error: any) {
        console.error('Error fetching meeting logs:', error)
        return { success: false, error: error.message }
    }
}

export async function updateMeetingLog(id: string, data: Partial<Omit<MeetingLog, 'id' | 'client_id' | 'created_at'>>) {
    try {
        const { data: log, error } = await supabase
            .from('meeting_logs')
            .update(data)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return { success: true, log }
    } catch (error: any) {
        console.error('Error updating meeting log:', error)
        return { success: false, error: error.message }
    }
}

export async function deleteMeetingLog(id: string) {
    try {
        const { error } = await supabase
            .from('meeting_logs')
            .delete()
            .eq('id', id)

        if (error) throw error
        return { success: true }
    } catch (error: any) {
        console.error('Error deleting meeting log:', error)
        return { success: false, error: error.message }
    }
}
