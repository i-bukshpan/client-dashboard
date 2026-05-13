'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  createWorkerMessage,
  updateWorkerMessageStatus,
  deleteWorkerMessage,
  addWorkerMessageReply,
} from '@/app/moshe/actions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import { he } from 'date-fns/locale'
import {
  Bot, Plus, Send, Trash2, CheckCircle2, Clock, Truck, Calendar,
  MessageSquare, ChevronDown, ChevronUp, X, Zap, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

// ─── Types ────────────────────────────────────────────────────────────

interface WorkerMessage {
  id: string
  worker_id: string
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

interface WorkerMessageReply {
  id: string
  message_id: string
  sender: 'worker' | 'admin'
  body: string
  created_at: string
}

interface Worker {
  id: string
  name: string
}

// ─── Metadata ─────────────────────────────────────────────────────────

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
  urgent: { label: 'דחוף',  dot: 'bg-red-500' },
}

const STATUS_META = {
  open:        { label: 'פתוח',   color: 'text-blue-600 bg-blue-50 border-blue-200' },
  in_progress: { label: 'בביצוע', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  done:        { label: 'הושלם',  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  cancelled:   { label: 'בוטל',   color: 'text-slate-400 bg-slate-50 border-slate-200' },
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  if (isToday(d)) return `היום ${format(d, 'HH:mm')}`
  if (isYesterday(d)) return `אתמול ${format(d, 'HH:mm')}`
  return format(d, 'dd/MM HH:mm', { locale: he })
}

// ─── Main Panel ───────────────────────────────────────────────────────

export function WorkerBotPanel({
  workerId,
  workerName,
  initialMessages,
}: {
  workerId: string
  workerName: string
  initialMessages: WorkerMessage[]
}) {
  const [messages, setMessages] = useState<WorkerMessage[]>(initialMessages)
  const [newOpen, setNewOpen]   = useState(false)
  const [thread, setThread]     = useState<WorkerMessage | null>(null)
  const supabase = createClient()

  // ── Realtime ───────────────────────────────────────────────────────
  useEffect(() => {
    const refetch = async () => {
      const { data } = await supabase
        .from('worker_messages')
        .select('*, replies:worker_message_replies(*)')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })
      if (data) {
        setMessages(data as WorkerMessage[])
        if (thread) {
          const updated = (data as WorkerMessage[]).find(m => m.id === thread.id)
          if (updated) setThread(updated)
        }
      }
    }

    const channel = supabase
      .channel(`admin-bot-${workerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_messages', filter: `worker_id=eq.${workerId}` }, refetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'worker_message_replies' }, refetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [workerId, thread?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const threadMsg = thread ? messages.find(m => m.id === thread.id) ?? thread : null
  const active = messages.filter(m => m.status !== 'done' && m.status !== 'cancelled')
  const done   = messages.filter(m => m.status === 'done' || m.status === 'cancelled')

  return (
    <div>
      {/* Header bar */}
      <div className="px-4 py-2.5 flex items-center justify-between bg-slate-50/50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-indigo-500" />
          <p className="text-[11px] font-bold text-slate-500 uppercase">בוט הודעות</p>
          {active.length > 0 && (
            <span className="text-[9px] bg-indigo-600 text-white font-black px-1.5 py-0.5 rounded-full">
              {active.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className="text-[11px] text-indigo-600 font-bold hover:text-indigo-700 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> הודעה חדשה
        </button>
      </div>

      {/* Message list */}
      <div className="divide-y divide-slate-50">
        {messages.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-6">לא נשלחו הודעות עדיין</p>
        )}
        {active.map(msg => (
          <AdminMessageRow
            key={msg.id}
            msg={msg}
            onClick={() => setThread(msg)}
          />
        ))}
        {done.length > 0 && (
          <details>
            <summary className="text-[10px] text-slate-400 font-bold uppercase px-4 py-2 cursor-pointer select-none bg-slate-50/50 hover:text-slate-600">
              הושלמו / בוטלו ({done.length})
            </summary>
            {done.map(msg => (
              <AdminMessageRow
                key={msg.id}
                msg={msg}
                onClick={() => setThread(msg)}
                faded
              />
            ))}
          </details>
        )}
      </div>

      {/* New message sheet */}
      <Sheet open={newOpen} onOpenChange={setNewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0" dir="rtl">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
            <SheetHeader>
              <SheetTitle className="text-base font-bold flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-500" />
                הודעה חדשה ל-{workerName}
              </SheetTitle>
            </SheetHeader>
          </div>
          <NewMessageForm
            workerId={workerId}
            onClose={() => setNewOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Thread sheet */}
      {threadMsg && (
        <Sheet open={!!threadMsg} onOpenChange={() => setThread(null)}>
          <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0" dir="rtl">
            <AdminChatThread
              message={threadMsg}
              workerName={workerName}
              onClose={() => setThread(null)}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

// ─── Admin message row ────────────────────────────────────────────────

function AdminMessageRow({
  msg,
  onClick,
  faded = false,
}: {
  msg: WorkerMessage
  onClick: () => void
  faded?: boolean
}) {
  const [, startTransition] = useTransition()
  const meta = TYPE_META[msg.type]
  const Icon = meta.icon

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('למחוק הודעה זו?')) return
    startTransition(async () => {
      const r = await deleteWorkerMessage(msg.id)
      if (r.error) toast.error(r.error)
    })
  }

  const workerReplies = msg.replies.filter(r => r.sender === 'worker').length

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-slate-50 transition-colors group',
        faded && 'opacity-50'
      )}
    >
      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', meta.bg)}>
        <Icon style={{ width: 16, height: 16 }} className={meta.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-bold text-slate-800 truncate flex-1">{msg.title}</p>
          <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded-full border shrink-0', STATUS_META[msg.status].color)}>
            {STATUS_META[msg.status].label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
          <span>{fmtDate(msg.created_at)}</span>
          {workerReplies > 0 && (
            <span className="text-indigo-500 font-bold">{workerReplies} תגובות עובד</span>
          )}
        </div>
      </div>
      <button
        onClick={handleDelete}
        className="w-6 h-6 flex items-center justify-center text-slate-200 hover:text-red-400 hover:bg-red-50 rounded shrink-0 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </button>
  )
}

// ─── New message form ──────────────────────────────────────────────────

const EMPTY_FORM = {
  type: 'message' as 'task' | 'delivery' | 'event' | 'message',
  title: '',
  body: '',
  due_date: '',
  location: '',
  priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
}

function NewMessageForm({ workerId, onClose }: { workerId: string; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('כותרת נדרשת')
    setSaving(true)
    const r = await createWorkerMessage({ ...form, worker_id: workerId })
    setSaving(false)
    if (r.error) { toast.error(r.error); return }
    toast.success('הודעה נשלחה ✓')
    onClose()
  }

  const types: { value: 'task' | 'delivery' | 'event' | 'message'; label: string; emoji: string }[] = [
    { value: 'task',     label: 'משימה',   emoji: '📋' },
    { value: 'delivery', label: 'שליחות', emoji: '🚚' },
    { value: 'event',    label: 'אירוע',   emoji: '📅' },
    { value: 'message',  label: 'הודעה',   emoji: '💬' },
  ]

  const showLocation = form.type === 'delivery' || form.type === 'event'
  const showDueDate  = form.type !== 'message'

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4">
      {/* Type selector */}
      <div className="space-y-1.5">
        <p className="text-xs font-bold text-slate-600">סוג הודעה</p>
        <div className="grid grid-cols-4 gap-1.5">
          {types.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setForm(f => ({ ...f, type: t.value }))}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-all',
                form.type === t.value
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                  : 'border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
              )}
            >
              <span className="text-lg">{t.emoji}</span>
              <span className="text-[10px]">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div className="space-y-1.5">
        <p className="text-xs font-bold text-slate-600">עדיפות</p>
        <div className="flex gap-2">
          {(['low','normal','high','urgent'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setForm(f => ({ ...f, priority: p }))}
              className={cn(
                'flex-1 py-1.5 rounded-lg border text-[10px] font-bold transition-all',
                form.priority === p
                  ? 'bg-slate-800 border-slate-800 text-white'
                  : 'border-slate-200 text-slate-400 hover:border-slate-400'
              )}
            >
              <span className={cn('inline-block w-1.5 h-1.5 rounded-full me-1', PRIORITY_META[p].dot)} />
              {PRIORITY_META[p].label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <p className="text-xs font-bold text-slate-600">כותרת <span className="text-red-400">*</span></p>
        <Input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="כותרת קצרה..."
          className="h-9 text-sm"
          required
        />
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <p className="text-xs font-bold text-slate-600">פרטים</p>
        <textarea
          value={form.body}
          onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          placeholder="תיאור מפורט (אופציונלי)..."
          rows={3}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
        />
      </div>

      {/* Location */}
      {showLocation && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-600">כתובת / מיקום</p>
          <Input
            value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="כתובת יעד..."
            className="h-9 text-sm"
          />
        </div>
      )}

      {/* Due date */}
      {showDueDate && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-600">תאריך ושעה</p>
          <Input
            type="datetime-local"
            value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
            className="h-9 text-sm"
          />
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">ביטול</Button>
        <Button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
          {saving ? 'שולח...' : 'שלח הודעה ✈'}
        </Button>
      </div>
    </form>
  )
}

// ─── Admin chat thread ─────────────────────────────────────────────────

function AdminChatThread({
  message: msg,
  workerName,
  onClose,
}: {
  message: WorkerMessage
  workerName: string
  onClose: () => void
}) {
  const [, startTransition] = useTransition()
  const [reply, setReply]   = useState('')
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
    const r = await addWorkerMessageReply(msg.id, reply, 'admin')
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
    <div className="flex flex-col h-full" dir="rtl">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3 shrink-0">
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-400">
          <X className="w-3.5 h-3.5" />
        </button>
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', meta.bg)}>
          <Icon style={{ width: 14, height: 14 }} className={meta.color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{msg.title}</p>
          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border', status.color)}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Messages scroll */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Original message */}
        <div className="bg-slate-100 rounded-2xl px-4 py-3">
          <p className="text-xs font-bold text-slate-700 mb-1">{msg.title}</p>
          {msg.body && <p className="text-xs text-slate-500">{msg.body}</p>}
          {msg.location && <p className="text-[10px] text-slate-400 mt-1">📍 {msg.location}</p>}
          {msg.due_date && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              ⏰ {format(new Date(msg.due_date), "EEEE dd/MM 'בשעה' HH:mm", { locale: he })}
            </p>
          )}
        </div>

        {/* Replies */}
        {[...msg.replies]
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map(r => (
            <div
              key={r.id}
              className={cn('flex', r.sender === 'admin' ? 'justify-start flex-row-reverse' : 'justify-start')}
            >
              <div className="max-w-[80%]">
                <div className={cn(
                  'rounded-2xl px-3 py-2 text-xs shadow-sm',
                  r.sender === 'admin'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                )}>
                  {r.body}
                </div>
                <p className={cn(
                  'text-[9px] text-slate-400 mt-0.5 px-1',
                  r.sender === 'admin' ? 'text-right' : 'text-left'
                )}>
                  {r.sender === 'admin' ? 'אתה' : workerName} · {fmtDate(r.created_at)}
                </p>
              </div>
            </div>
          ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick status buttons */}
      {msg.status !== 'done' && msg.status !== 'cancelled' && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0">
          {msg.status !== 'in_progress' && (
            <button
              onClick={() => handleStatus('in_progress')}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded-xl whitespace-nowrap hover:bg-amber-100 transition-colors"
            >
              <Zap className="w-3 h-3" /> סמן כבביצוע
            </button>
          )}
          <button
            onClick={() => handleStatus('done')}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-xl whitespace-nowrap hover:bg-emerald-100 transition-colors"
          >
            <CheckCircle2 className="w-3 h-3" /> סמן כהושלם
          </button>
          <button
            onClick={() => handleStatus('cancelled')}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-500 text-[10px] font-bold rounded-xl whitespace-nowrap hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> בטל
          </button>
        </div>
      )}

      {/* Reply input */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2 shrink-0">
        <input
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
          placeholder={`כתוב ל-${workerName}...`}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-right outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
        />
        <button
          onClick={handleReply}
          disabled={sending || !reply.trim()}
          className="w-8 h-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors"
        >
          <Send className="w-3.5 h-3.5 rotate-180" />
        </button>
      </div>
    </div>
  )
}
