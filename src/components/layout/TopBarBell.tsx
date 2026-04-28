'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Bell } from 'lucide-react'

interface Props {
  currentUserId: string
  initialUnread: number
  urgentCount: number
  onClick: () => void
}

export function TopBarBell({ currentUserId, initialUnread, urgentCount, onClick }: Props) {
  const [unread, setUnread] = useState(initialUnread)
  const supabase = createClient()

  const fetchUnread = async () => {
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('id')
      .neq('sender_id', currentUserId)

    if (!messages) return

    const { data: receipts } = await supabase
      .from('chat_read_receipts')
      .select('message_id')
      .eq('user_id', currentUserId)

    const readIds = new Set((receipts as any[])?.map((r: any) => r.message_id) || [])
    setUnread((messages as any[]).filter((m: any) => !readIds.has(m.id)).length)
  }

  useEffect(() => {
    setUnread(initialUnread)
  }, [initialUnread])

  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`topbar-bell-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, fetchUnread)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_read_receipts', filter: `user_id=eq.${currentUserId}` }, fetchUnread)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUserId])

  const total = unread + urgentCount

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-xl text-muted-foreground hover:text-foreground relative"
      onClick={onClick}
      title="התראות"
    >
      <Bell className="w-4 h-4" />
      {total > 0 && (
        <span className="absolute top-1.5 start-1.5 w-2 h-2 bg-red-500 rounded-full" />
      )}
    </Button>
  )
}
