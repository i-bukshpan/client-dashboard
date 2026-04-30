'use client'

import { useState, useEffect, useId } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { usePathname } from 'next/navigation'

interface Props {
  currentUserId: string
  initialCount: number
}

async function getUnreadCount(supabase: ReturnType<typeof createClient>, currentUserId: string) {
  const { data: messages } = await (supabase.from('chat_messages') as any)
    .select('id')
    .neq('sender_id', currentUserId)

  if (!messages || messages.length === 0) return 0

  const { data: receipts } = await (supabase.from('chat_read_receipts') as any)
    .select('message_id')
    .eq('user_id', currentUserId)
    .in('message_id', messages.map((m: any) => m.id))

  const readIds = new Set(receipts?.map((r: any) => r.message_id) || [])
  return (messages as any[]).filter(m => !readIds.has(m.id)).length
}

export function SidebarUnreadBadge({ currentUserId, initialCount }: Props) {
  const [count, setCount] = useState(initialCount)
  const pathname = usePathname()
  // useId() is stable per instance and consistent across SSR/CSR — avoids channel
  // name collision when both desktop sidebar and mobile sheet render this component
  const instanceId = useId().replace(/:/g, '')

  useEffect(() => {
    if (!currentUserId) return

    const supabase = createClient()
    let cancelled = false

    getUnreadCount(supabase, currentUserId).then(n => {
      if (!cancelled) setCount(n)
    })

    const channel = supabase
      .channel(`sidebar-unread-${currentUserId}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => getUnreadCount(supabase, currentUserId).then(n => { if (!cancelled) setCount(n) })
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_read_receipts', filter: `user_id=eq.${currentUserId}` },
        () => getUnreadCount(supabase, currentUserId).then(n => { if (!cancelled) setCount(n) })
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [currentUserId, instanceId])

  // Re-fetch when navigating to/from chat (read receipts may have been written)
  useEffect(() => {
    if (!pathname?.includes('/chat') || !currentUserId) return
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const n = await getUnreadCount(supabase, currentUserId)
      setCount(n)
    }, 1500)
    return () => clearTimeout(timer)
  }, [pathname, currentUserId])

  if (count === 0) return null

  return (
    <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 min-w-[1.25rem] h-5 rounded-full flex items-center justify-center border-none shadow-sm shadow-red-500/30">
      {count}
    </Badge>
  )
}
