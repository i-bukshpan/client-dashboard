'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ClientDataRecord } from '@/lib/supabase'

interface RealtimeSubscriberProps {
  clientId: string
  moduleType: string
  onRecordChange: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    record?: ClientDataRecord
    oldRecord?: ClientDataRecord
  }) => void
}

/**
 * Component that subscribes to real-time changes for client_data_records
 * Uses Supabase Realtime to automatically update the UI when data changes
 */
export function RealtimeSubscriber({ clientId, moduleType, onRecordChange }: RealtimeSubscriberProps) {
  const channelRef = useRef<any>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  useEffect(() => {
    // Create a unique channel name for this client and module
    const channelName = `client_data_records:${clientId}:${moduleType}`
    
    // Create a channel for this client and module
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'client_data_records',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          console.log('[Realtime] Received change:', payload.eventType, payload)
          
          // Only process changes for this module
          const newRecord = payload.new as ClientDataRecord | null
          const oldRecord = payload.old as ClientDataRecord | null
          
          if (newRecord && newRecord.module_type !== moduleType) {
            return // Ignore changes from other modules
          }
          if (oldRecord && oldRecord.module_type !== moduleType) {
            return // Ignore changes from other modules
          }

          // Process the change based on event type
          if (payload.eventType === 'INSERT' && newRecord) {
            onRecordChange({
              eventType: 'INSERT',
              record: newRecord,
            })
          } else if (payload.eventType === 'UPDATE' && newRecord) {
            onRecordChange({
              eventType: 'UPDATE',
              record: newRecord,
              oldRecord: oldRecord || undefined,
            })
          } else if (payload.eventType === 'DELETE' && oldRecord) {
            onRecordChange({
              eventType: 'DELETE',
              oldRecord: oldRecord,
            })
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('disconnected')
          console.error('[Realtime] Connection error:', status)
        } else {
          setConnectionStatus('connecting')
        }
      })

    channelRef.current = channel

    // Cleanup function
    return () => {
      if (channelRef.current) {
        console.log('[Realtime] Unsubscribing from channel:', channelName)
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
        setConnectionStatus('disconnected')
      }
    }
  }, [clientId, moduleType, onRecordChange])

  // This component doesn't render anything visible
  // Connection status is handled internally for debugging
  return null
}

