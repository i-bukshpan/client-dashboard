'use server'

import { supabase } from '@/lib/supabase'

export interface ClientLink {
    id: string
    client_id: string
    title: string
    url: string
    link_type: 'google_sheets' | 'google_drive' | 'google_docs' | 'dropbox' | 'onedrive' | 'website' | 'other'
    description?: string | null
    created_at: string
    updated_at: string
}

export async function getClientLinks(clientId: string) {
    try {
        const { data, error } = await supabase
            .from('client_links')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })

        if (error) throw error
        return { success: true, links: data as ClientLink[] }
    } catch (error: any) {
        console.error('Error fetching client links:', error)
        return { success: false, error: error.message }
    }
}

export async function addClientLink(
    clientId: string,
    title: string,
    url: string,
    linkType: string = 'other',
    description?: string
) {
    try {
        const { data, error } = await supabase
            .from('client_links')
            .insert([{
                client_id: clientId,
                title,
                url,
                link_type: linkType,
                description: description || null,
            }])
            .select()
            .single()

        if (error) throw error
        return { success: true, link: data as ClientLink }
    } catch (error: any) {
        console.error('Error adding client link:', error)
        return { success: false, error: error.message }
    }
}

export async function updateClientLink(
    linkId: string,
    updates: {
        title?: string
        url?: string
        link_type?: string
        description?: string | null
    }
) {
    try {
        const { data, error } = await supabase
            .from('client_links')
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq('id', linkId)
            .select()
            .single()

        if (error) throw error
        return { success: true, link: data as ClientLink }
    } catch (error: any) {
        console.error('Error updating client link:', error)
        return { success: false, error: error.message }
    }
}

export async function deleteClientLink(linkId: string) {
    try {
        const { error } = await supabase
            .from('client_links')
            .delete()
            .eq('id', linkId)

        if (error) throw error
        return { success: true }
    } catch (error: any) {
        console.error('Error deleting client link:', error)
        return { success: false, error: error.message }
    }
}
