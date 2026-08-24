'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, CheckCircle2, Loader2, Send, ShieldAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { confirmInternalFinanceMutationAction } from '@/app/workspace/actions/internal-finance'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { PendingInternalFinanceMutation } from '@/types/internal-finance'

interface ChatMessage { role: 'user' | 'assistant'; content: string }

export function InternalFinanceAI() {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: 'מה תרצה לבדוק בכספי הסוכנות? אפשר לבקש ניתוח, או להציע רישום הכנסה, הוצאה, ריטיינר או חשבונית.' }])
  const [input, setInput] = useState('')
  const [pendingMutation, setPendingMutation] = useState<PendingInternalFinanceMutation | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const content = input.trim()
    if (!content || loading) return
    const nextMessages = [...messages, { role: 'user' as const, content }]
    setMessages(nextMessages)
    setInput('')
    setPendingMutation(null)
    setLoading(true)
    try {
      const response = await fetch('/api/workspace/internal-finance/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: nextMessages.slice(-20) }) })
      const body: { reply?: string; pending?: PendingInternalFinanceMutation | null; error?: string } = await response.json()
      if (!response.ok || body.error) throw new Error(body.error || 'הסוכן לא הצליח להשיב')
      setMessages((current) => [...current, { role: 'assistant', content: body.reply ?? 'לא התקבלה תשובה' }])
      setPendingMutation(body.pending ?? null)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשיחה עם הסוכן')
    } finally { setLoading(false) }
  }

  async function confirm() {
    if (!pendingMutation) return
    setConfirming(true)
    const result = await confirmInternalFinanceMutationAction({ token: pendingMutation.token, confirmed: true })
    setConfirming(false)
    if ('error' in result) return toast.error(result.error)
    setMessages((current) => [...current, { role: 'assistant', content: 'הפעולה אושרה ונרשמה בגיליון Google Sheets.' }])
    setPendingMutation(null)
    toast.success('הפעולה הכספית נרשמה')
    router.refresh()
  }

  return (
    <section className="flex min-h-[520px] flex-col rounded-2xl border border-border bg-card">
      <header className="flex items-center gap-3 border-b border-border p-4">
        <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400"><Bot /></span>
        <div><h2 className="font-bold">הסוכן הפיננסי</h2><p className="text-xs text-muted-foreground">גישה לקריאה · כתיבה רק לאחר אישור מפורש</p></div>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'mr-auto bg-indigo-600 text-white' : 'ml-auto bg-muted text-foreground'}`}>{message.content}</div>)}
        {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> מנתח את הגיליון…</div>}
        {pendingMutation && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2 font-bold text-amber-300"><ShieldAlert /> נדרש אישור לפעולה כספית</div>
            <p className="mt-2 text-sm">{pendingMutation.summary}</p>
            <p className="mt-1 text-xs text-muted-foreground">{pendingMutation.operation === 'append' ? 'הוספת רשומה חדשה' : `עדכון רשומה ${pendingMutation.targetId}`}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">{Object.entries(pendingMutation.values).map(([key, value]) => <div key={key} className="rounded-lg bg-background/60 p-2"><dt className="text-muted-foreground">{key}</dt><dd className="mt-1 font-medium">{value || '—'}</dd></div>)}</dl>
            <p className="mt-3 text-xs text-muted-foreground">האישור תקף עד {new Date(pendingMutation.expiresAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}. ללא לחיצה על אישור לא יתבצע כל שינוי.</p>
            <div className="mt-4 flex gap-2"><Button onClick={confirm} disabled={confirming}>{confirming ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} מאשר ורושם בגיליון</Button><Button variant="outline" onClick={() => setPendingMutation(null)}><X /> ביטול</Button></div>
          </div>
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
        <Textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="לדוגמה: רשום הוצאה של 850 ₪ עבור תוכנה…" rows={2} disabled={loading} />
        <Button type="submit" size="icon-lg" disabled={loading || !input.trim()} aria-label="שליחה"><Send /></Button>
      </form>
    </section>
  )
}
