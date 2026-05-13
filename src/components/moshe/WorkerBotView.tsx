'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addWorkerMessageReply, updateWorkerMessageStatus } from '@/app/moshe/actions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import { he } from 'date-fns/locale'
import {
  Send, CheckCircle2, Clock, Truck, Calendar, MessageSquare,
  ChevronLeft, Zap, RotateCcw, X, Bot,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────

export interface WorkerMessage {
  id: string
  type: 'task' | 'delivery' | 'event' | 'message'
  title: string
  body: string | null
  due_date: string | null
  location: string | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'done' | 'cancelled'
  created_at: string
  replies: WorkerMessageReply[]
}

export interface WorkerMessageReply {
  id: string
  message_id: string
  sender: 'worker' | 'admin'
  body: string
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────

const TYPE_META = {
  task:     { label: 'משימה',   icon: CheckCircle2, color: 'text-indigo-500',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  delivery: { label: 'שליחות', icon: Truck,         color: 'text-orange-500', bg: 'bg-orange-50',  border: 'border-orange-200' },
  event:    { label: 'אירוע',  icon: Calendar,      color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  message:  { label: 'הודעה',  icon: MessageSquare, color: 'text-slate-500',  bg: 'bg-slate-50',   border: 'border-slate-200' },
}

const PRIORITY_META = {
  low:    { label: 'נמוך',  dot: 'bg-slate-300' },
  normal: { label: 'רגיל',  dot: 'bg-blue-400' },
  high:   { label: 'גבוה',  dot: 'bg-amber-400' },
  urgent: { label: 'דחוף',  dot: 'bg-red-500 animate-pulse' },
}

const STATUS_META = {
  open:        { label: 'פתוח',     color: 'text-blue-600 bg-blue-50 border-blue-200' },
  in_progress: { label: 'בביצוע',   color: 'text-amber-600 bg-amber-50 border-amber-200' },
  done:        { label: 'הושלם',    color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  cancelled:   { label: 'בוטל',     color: 'text-slate-400 bg-slate-50 border-slate-200' },
}

function formatMsgDate(iso: string) {
  const d = new Date(iso)
  if (isToday(d)) return `היום ${format(d, 'HH:mm')}`
  if (isYesterday(d)) return `אתמול ${format(d, 'HH:mm')}`
  return format(d, 'dd/MM HH:mm', { locale: he })
}

// ─── Main Component ──────────────────────────────────────────────────

export function WorkerBotView({
  messages: initialMessages,
  workerName,
  workerId,
}: {
  messages: WorkerMessage[]
  workerName: string
  workerId: string
}) {
  const [messages, setMessages] = useState<WorkerMessage[]>(initialMessages)
  const [open, setOpen] = useState<WorkerMessage | null>(null)
  const supabase = createClient()

  // ── Realtime subscription ──────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`worker-bot-${workerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'worker_messages', filter: `worker_id=eq.${workerId}` },
        async () => {
          // Re-fetch messages on any change
          const { data } = await supabase
            .from('worker_messages')
            .select('*, replies:worker_message_replies(*)')
            .eq('worker_id', workerId)
            .order('created_at', { ascending: false })
          if (data) {
            setMessages(data as WorkerMessage[])
            // Update open message if it's in the new data
            if (open) {
              const updated = (data as WorkerMessage[]).find(m => m.id === open.id)
              if (updated) setOpen(updated)
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'worker_message_replies' },
        async () => {
          const { data } = await supabase
            .from('worker_messages')
            .select('*, replies:worker_message_replies(*)')
            .eq('worker_id', workerId)
            .order('created_at', { ascending: false })
          if (data) {
            setMessages(data as WorkerMessage[])
            if (open) {
              const updated = (data as WorkerMessage[]).find(m => m.id === open.id)
              if (updated) setOpen(updated)
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [workerId, open?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const openMsg = open ? messages.find(m => m.id === open.id) ?? open : null
  const activeMessages = messages.filter(m => m.status !== 'done' && m.status !== 'cancelled')
  const doneMessages   = messages.filter(m => m.status === 'done' || m.status === 'cancelled')

  return (
    <>
      {/* Chat thread overlay */}
      {openMsg && (
        <ChatThread
          message={openMsg}
          onClose={() => setOpen(null)}
          workerId={workerId}
        />
      )}

      {/* Bot feed */}
      <div className="space-y-3">
        {/* Bot header */}
        <div className="flex items-center gap-3 px-1 mb-5">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          <div>
            <p className="font-black text-slate-900 text-sm">נחמיה בוט 🤖</p>
            <p className="text-[11px] text-slate-400">
              {activeMessages.length > 0
                ? `${activeMessages.length} פריטים מחכים לך`
                : 'אין פריטים פעילים כרגע'}
            </p>
          </div>
        </div>

        {/* Opening message bubble */}
        <BotBubble>
          <p className="text-sm">
            שלום <strong>{workerName}</strong> 👋
            {activeMessages.length > 0
              ? ` יש לך ${activeMessages.length} פריטים שמחכים לטיפול:`
              : ' הכל נראה מעולה, אין לך פריטים פתוחים כרגע 🎉'}
          </p>
        </BotBubble>

        {/* Active messages */}
        {activeMessages.map(msg => (
          <MessageCard
            key={msg.id}
            message={msg}
            onClick={() => setOpen(msg)}
          />
        ))}

        {/* Done messages */}
        {doneMessages.length > 0 && (
          <details className="mt-2">
            <summary className="text-[11px] text-slate-400 font-bold cursor-pointer select-none px-1 py-2 hover:text-slate-600">
              הושלמו / בוטלו ({doneMessages.length})
            </summary>
            <div className="space-y-2 mt-2">
              {doneMessages.map(msg => (
                <MessageCard
                  key={msg.id}
                  message={msg}
                  onClick={() => setOpen(msg)}
                  faded
                />
              ))}
            </div>
          </details>
        )}

        {messages.length === 0 && (
          <div className="text-center py-14">
            <Bot className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">אין הודעות עדיין</p>
            <p className="text-slate-300 text-xs mt-1">המנהל ישלח לך הודעות בקרוב</p>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Bot bubble (generic) ─────────────────────────────────────────────

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-100 shadow-sm px-4 py-3 max-w-xs text-slate-700">
        {children}
      </div>
    </div>
  )
}

// ─── Message card ─────────────────────────────────────────────────────

function MessageCard({
  message: msg,
  onClick,
  faded = false,
}: {
  message: WorkerMessage
  onClick: () => void
  faded?: boolean
}) {
  const meta     = TYPE_META[msg.type]
  const priority = PRIORITY_META[msg.priority]
  const status   = STATUS_META[msg.status]
  const Icon     = meta.icon
  const unread   = msg.replies.filter(r => r.sender === 'admin').length

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-right flex items-start gap-3 bg-white rounded-2xl border shadow-sm px-4 py-3.5 hover:shadow-md transition-all group',
        meta.border,
        faded && 'opacity-50'
      )}
    >
      {/* Icon */}
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', meta.bg)}>
        <Icon className={cn('w-4.5 h-4.5', meta.color)} style={{ width: 18, height: 18 }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-right">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <p className="text-sm font-bold text-slate-900 truncate flex-1">{msg.title}</p>
          {/* Priority dot */}
          <span className={cn('w-2 h-2 rounded-full shrink-0', priority.dot)} title={priority.label} />
        </div>

        {msg.body && (
          <p className="text-[11px] text-slate-500 truncate mb-1">{msg.body}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status badge */}
          <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full border', status.color)}>
            {status.label}
          </span>
          {/* Due date */}
          {msg.due_date && (
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
              <Clock style={{ width: 10, height: 10 }} />
              {format(new Date(msg.due_date), 'dd/MM HH:mm', { locale: he })}
            </span>
          )}
          {/* Replies count */}
          {unread > 0 && (
            <span className="text-[10px] font-bold text-indigo-600">
              {unread} תגובות
            </span>
          )}
        </div>
      </div>

      <ChevronLeft className="w-4 h-4 text-slate-200 group-hover:text-slate-400 shrink-0 mt-1 transition-colors" />
    </button>
  )
}

// ─── Chat thread ──────────────────────────────────────────────────────

function ChatThread({
  message: msg,
  onClose,
  workerId,
}: {
  message: WorkerMessage
  onClose: () => void
  workerId: string
}) {
  const [, startTransition] = useTransition()
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const meta   = TYPE_META[msg.type]
  const status = STATUS_META[msg.status]
  const Icon   = meta.icon

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msg.replies.length])

  async function handleReply() {
    if (!reply.trim()) return
    setSending(true)
    const r = await addWorkerMessageReply(msg.id, reply, 'worker')
    setSending(false)
    if (r.error) { toast.error(r.error); return }
    setReply('')
  }

  function handleStatus(s: 'open' | 'in_progress' | 'done' | 'cancelled') {
    startTransition(async () => {
      const r = await updateWorkerMessageStatus(msg.id, s)
      if (r.error) toast.error(r.error)
      else toast.success('סטטוס עודכן')
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', meta.bg)}>
          <Icon className={cn('w-4 h-4', meta.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{msg.title}</p>
          <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full border', status.color)}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Original message from bot/admin */}
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-sm">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="max-w-[80%]">
            <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-100 shadow-sm px-4 py-3">
              <p className="text-sm font-bold text-slate-800 mb-1">{msg.title}</p>
              {msg.body && <p className="text-sm text-slate-600">{msg.body}</p>}
              {msg.location && (
                <p className="text-xs text-slate-400 mt-1.5">📍 {msg.location}</p>
              )}
              {msg.due_date && (
                <p className="text-xs text-slate-400 mt-0.5">
                  ⏰ {format(new Date(msg.due_date), "EEEE dd/MM 'בשעה' HH:mm", { locale: he })}
                </p>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 px-1">{formatMsgDate(msg.created_at)}</p>
          </div>
        </div>

        {/* Reply bubbles */}
        {[...msg.replies]
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map(r => (
            <div
              key={r.id}
              className={cn('flex', r.sender === 'worker' ? 'justify-start flex-row-reverse' : 'justify-start')}
            >
              {r.sender === 'admin' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 ms-0 me-2 shadow-sm">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div className="max-w-[75%]">
                <div className={cn(
                  'rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                  r.sender === 'worker'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'
                )}>
                  {r.body}
                </div>
                <p className={cn(
                  'text-[10px] text-slate-400 mt-0.5 px-1',
                  r.sender === 'worker' && 'text-right'
                )}>
                  {formatMsgDate(r.created_at)}
                </p>
              </div>
            </div>
          ))}

        <div ref={bottomRef} />
      </div>

      {/* Quick action buttons */}
      {msg.status !== 'done' && msg.status !== 'cancelled' && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          {msg.status !== 'in_progress' && (
            <button
              onClick={() => handleStatus('in_progress')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-xl whitespace-nowrap hover:bg-amber-100 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" /> בטיפול
            </button>
          )}
          <button
            onClick={() => handleStatus('done')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl whitespace-nowrap hover:bg-emerald-100 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> סיימתי ✓
          </button>
          <button
            onClick={() => handleStatus('cancelled')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-500 text-xs font-bold rounded-xl whitespace-nowrap hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> בטל
          </button>
        </div>
      )}

      {/* Reply input */}
      <div className="bg-white border-t border-slate-100 px-4 py-3 flex items-center gap-2.5">
        <input
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
          placeholder="כתוב תגובה..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-right outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
        />
        <button
          onClick={handleReply}
          disabled={sending || !reply.trim()}
          className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
        >
          <Send className="w-4 h-4 rotate-180" />
        </button>
      </div>
    </div>
  )
}
