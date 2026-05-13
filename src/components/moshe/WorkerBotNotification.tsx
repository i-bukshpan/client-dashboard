'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Bot, MessageCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'

interface PendingReply {
  messageId: string
  messageTitle: string
  workerName: string
  lastReply: string
  repliedAt: string
}

interface Props {
  /** Initial unread worker-replies loaded server-side */
  initialPending: PendingReply[]
}

export function WorkerBotNotification({ initialPending }: Props) {
  const [pending, setPending] = useState<PendingReply[]>(initialPending)
  const [open, setOpen] = useState(false)
  const supabase = createClient()
  const pendingRef = useRef<PendingReply[]>(initialPending)
  pendingRef.current = pending

  // ── Realtime: listen to ALL worker_messages & replies ───────────────
  useEffect(() => {
    async function refetch() {
      // Fetch all open/in_progress messages that have at least one worker reply
      const { data: msgs } = await supabase
        .from('worker_messages')
        .select(`
          id, title, status,
          replies:worker_message_replies(sender, body, created_at),
          worker:worker_id(name)
        `)
        .in('status', ['open', 'in_progress'])
        .order('updated_at', { ascending: false })

      if (!msgs) return

      const results: PendingReply[] = []
      for (const msg of msgs as any[]) {
        const workerReplies = (msg.replies ?? []).filter((r: any) => r.sender === 'worker')
        if (workerReplies.length === 0) continue
        const last = [...workerReplies].sort((a: any, b: any) =>
          b.created_at.localeCompare(a.created_at)
        )[0]
        results.push({
          messageId:    msg.id,
          messageTitle: msg.title,
          workerName:   (msg.worker as any)?.name ?? 'עובד',
          lastReply:    last.body,
          repliedAt:    last.created_at,
        })
      }
      setPending(results)
    }

    const channel = supabase
      .channel('admin-worker-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_messages' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_message_replies' }, refetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const count = pending.length

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
          open
            ? 'bg-white/15 text-white'
            : 'text-white/50 hover:text-white hover:bg-white/8'
        )}
      >
        <div className="relative">
          <Bot className="w-4 h-4 shrink-0" />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[7px] font-black rounded-full flex items-center justify-center animate-pulse">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </div>
        <span>תגובות עובדים</span>
        {count > 0 && (
          <span className="ms-auto bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute bottom-full right-0 left-0 mb-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 max-h-80 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
            <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-indigo-500" />
              תגובות עובדים ממתינות
            </p>
            <button
              onClick={() => setOpen(false)}
              className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {pending.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">אין תגובות ממתינות</p>
            ) : (
              pending.map(p => (
                <Link
                  key={p.messageId}
                  href="/moshe/workers"
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                >
                  <div className="w-7 h-7 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-black text-indigo-600">{p.workerName[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{p.workerName}</p>
                    <p className="text-[10px] text-slate-500 truncate">{p.messageTitle}</p>
                    <p className="text-[10px] text-indigo-600 truncate mt-0.5">"{p.lastReply}"</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      {formatDistanceToNow(new Date(p.repliedAt), { locale: he, addSuffix: true })}
                    </p>
                  </div>
                  <div className="w-2 h-2 bg-red-500 rounded-full shrink-0 mt-1.5 animate-pulse" />
                </Link>
              ))
            )}
          </div>

          {pending.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 shrink-0">
              <Link
                href="/moshe/workers"
                onClick={() => setOpen(false)}
                className="text-xs text-indigo-600 font-bold hover:text-indigo-700"
              >
                עבור לניהול עובדים →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
