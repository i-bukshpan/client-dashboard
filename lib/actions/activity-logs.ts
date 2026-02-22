'use server'

import { supabase } from '@/lib/supabase'

export type ClientActivityLog = {
    id: string
    client_id: string
    activity_type: string
    description: string
    metadata: Record<string, any>
    created_at: string
    created_by: string | null
}

export type LogActivityParams = {
    clientId: string
    activityType: 'NOTE_ADDED' | 'PAYMENT_RECEIVED' | 'RECORD_CREATED' | 'STATUS_CHANGED' | 'INVOICE_SCANNED' | 'CLIENT_CREATED' | 'CREDENTIAL_ADDED' | 'LINK_ADDED'
    description: string
    metadata?: Record<string, any>
}

export async function logClientActivity({ clientId, activityType, description, metadata = {} }: LogActivityParams) {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        // It is possible this is called by an unauthenticated admin/system trigger, 
        // we'll allow created_by to be null if there is no user context.
        const createdBy = user ? user.id : null

        const { error } = await supabase
            .from('client_activity_logs')
            .insert({
                client_id: clientId,
                activity_type: activityType,
                description,
                metadata,
                created_by: createdBy
            })

        if (error) throw error

        return { success: true }
    } catch (error: any) {
        console.error('Error logging client activity:', error)
        return { success: false, error: error.message }
    }
}

export async function getClientActivityLogs(clientId: string, limit = 50) {
    try {
        const { data, error } = await supabase
            .from('client_activity_logs')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error

        return { success: true, logs: data as ClientActivityLog[] }
    } catch (error: any) {
        console.error('Error fetching client activity logs:', error)
        return { success: false, error: error.message, logs: [] }
    }
}

