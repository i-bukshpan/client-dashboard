'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { usePathname } from 'next/navigation'

interface Props {
  currentUserId: string
  initialCount: number
}

export function SidebarUnreadBadge({ currentUserId, initialCount }: Props) {
  const [count, setCount] = useState(initialCount)
  const supabase = createClient()
  const pathname = usePathname()

  const fetchCount = useCallback(async () => {
    // All messages not sent by current user
    const { data: messages } = await (supabase.from('chat_messages') as any)
      .select('id')
      .neq('sender_id', currentUserId)

    if (!messages || messages.length === 0) {
      setCount(0)
      return
    }

    // Which ones have a read receipt by us
    const { data: receipts } = await (supabase.from('chat_read_receipts') as any)
      .select('message_id')
      .eq('user_id', currentUserId)
      .in('message_id', messages.map((m: any) => m.id))

    const readIds = new Set(receipts?.map((r: any) => r.message_id) || [])
    const unread = (messages as any[]).filter(m => !readIds.has(m.id))
    setCount(unread.length)
  }, [currentUserId])

  // When user navigates to the chat page, immediately re-fetch
  // The chat interface handles marking messages as read, so we just need to re-count
  useEffect(() => {
    const isChatPage = pathname?.includes('/chat')
    if (isChatPage) {
      // Delay slightly to allow read receipts to be written by ChatInterface
      const timer = setTimeout(() => fetchCount(), 1500)
      return () => clearTimeout(timer)
    }
  }, [pathname, fetchCount])

  useEffect(() => {
    if (!currentUserId) return

    fetchCount()

    const channel = supabase
      .channel(`sidebar-unread-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => fetchCount()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_read_receipts', filter: `user_id=eq.${currentUserId}` },
        () => fetchCount()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, fetchCount])

  if (count === 0) return null

  return (
    <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 min-w-[1.25rem] h-5 rounded-full flex items-center justify-center border-none shadow-sm shadow-red-500/30">
      {count}
    </Badge>
  )
}
