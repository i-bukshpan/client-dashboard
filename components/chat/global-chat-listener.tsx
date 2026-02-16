'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function GlobalChatListener() {
    useEffect(() => {
        // Initial load of unread count
        const fetchUnreadCount = async () => {
            const { count, error } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('is_read', false)
                .eq('sender_role', 'client')

            if (!error && count !== null) {
                window.dispatchEvent(new CustomEvent('chat-unread-count', { detail: count }))
            }
        }

        fetchUnreadCount()

        // Subscribe to all new messages
        const channel = supabase
            .channel('global:messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: 'sender_role=eq.client'
            }, () => {
                // When a new client message arrives, re-fetch count
                fetchUnreadCount()
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages'
            }, () => {
                // When messages are updated (e.g. marked as read), re-fetch count
                fetchUnreadCount()
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'messages'
            }, () => {
                // If messages are deleted, re-fetch count
                fetchUnreadCount()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    return null // This is a logic-only component
}
