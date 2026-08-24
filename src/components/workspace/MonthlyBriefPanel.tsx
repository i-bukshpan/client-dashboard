'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Copy, FileCheck2, Loader2, MessageCircleQuestion, RefreshCw, Share2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { approveMonthlyBriefAction, generateMonthlyBriefAction, shareMonthlyBriefAction } from '@/app/workspace/actions/monthly-brief'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MonthlyBriefRecord } from '@/types/monthly-brief'

const stateLabel = { needs_input: 'ממתין למידע', draft: 'טיוטה לאישור', approved: 'מאושר' }

export function MonthlyBriefPanel({ clientId, briefs }: { clientId: string; briefs: MonthlyBriefRecord[] }) {
  const router = useRouter()
  const monthParts = new Intl.DateTimeFormat('en', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Jerusalem' }).formatToParts(new Date())
  const defaultMonth = `${monthParts.find((part) => part.type === 'year')?.value}-${monthParts.find((part) => part.type === 'month')?.value}`
  const [month, setMonth] = useState(briefs[0]?.reportMonth ?? defaultMonth)
  const [busy, setBusy] = useState<string | null>(null)
  const current = useMemo(() => briefs.find((brief) => brief.reportMonth === month) ?? null, [briefs, month])

  async function generate() { setBusy('generate'); const result = await generateMonthlyBriefAction(clientId, month); setBusy(null); if ('error' in result) return toast.error(result.error); if (result.brief.state === 'needs_input') toast.warning('הבריף ממתין למידע נוסף—השאלות נשלחו לצ׳אט'); else toast.success('טיוטת הבריף נוצרה'); router.refresh() }
  async function approve() { if (!current) return; setBusy('approve'); const result = await approveMonthlyBriefAction(clientId, current.id); setBusy(null); if ('error' in result) return toast.error(result.error); toast.success('הבריף אושר ונשמר ב-Google Drive'); router.refresh() }
  async function share() { if (!current) return; setBusy('share'); const result = await shareMonthlyBriefAction(clientId, current.id, 30); setBusy(null); if ('error' in result) return toast.error(result.error); await navigator.clipboard.writeText(result.shareUrl); toast.success('קישור מאובטח ל-30 יום הועתק') }

  return <div dir="rtl" className="mx-auto max-w-5xl space-y-5 overflow-y-auto p-6"><header className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-black"><Sparkles className="text-violet-400" /> הבריף החודשי</h2><p className="mt-1 text-sm text-muted-foreground">סיכום מבוסס ראיות מהגיליון, משימות, יומן ו-Drive</p></div><div className="flex items-end gap-2"><div><label className="text-xs text-muted-foreground" htmlFor="brief-month">חודש דיווח</label><Input id="brief-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div><Button onClick={generate} disabled={Boolean(busy)}>{busy === 'generate' ? <Loader2 className="animate-spin" /> : <RefreshCw />} {current?.reportMonth === month ? 'יצירה מחדש' : 'יצירת בריף'}</Button></div></header>
    {!current ? <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">טרם נוצר בריף חודשי</div> : <article className="space-y-5 rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><h3 className="text-lg font-black">בריף {current.reportMonth}</h3><p className="text-xs text-muted-foreground">עודכן {new Date(current.updatedAt).toLocaleString('he-IL')}</p></div><Badge className={current.state === 'approved' ? 'bg-emerald-500/15 text-emerald-400' : current.state === 'needs_input' ? 'bg-amber-500/15 text-amber-400' : 'bg-indigo-500/15 text-indigo-400'}>{stateLabel[current.state]}</Badge></div>
      <BriefSection title="מצב נוכחי"><p className="leading-7">{current.currentStatus}</p></BriefSection><BriefSection title="מה בוצע החודש"><List items={current.completedThisMonth} /></BriefSection><BriefSection title="פעולות ממתינות"><List items={current.pendingActions} /></BriefSection>
      {current.missingInformation.length > 0 && <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5"><h3 className="flex items-center gap-2 font-black text-amber-300"><MessageCircleQuestion /> נדרש מידע מנחמיה</h3><div className="mt-4 space-y-4">{current.missingInformation.map((item) => <div key={item.id}><p className="font-medium">{item.question}</p><div className="mt-2 flex flex-wrap gap-2">{item.options.map((option) => <Badge key={option} variant="outline">{option}</Badge>)}</div></div>)}</div><p className="mt-4 text-xs text-muted-foreground">השאלות מופיעות אוטומטית גם בלשונית AI Agent. התשובה בצ׳אט תחדש את יצירת הבריף.</p></section>}
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">{current.state === 'draft' && <Button onClick={approve} disabled={Boolean(busy)}>{busy === 'approve' ? <Loader2 className="animate-spin" /> : <FileCheck2 />} אישור ושמירה ב-Drive</Button>}{current.state === 'approved' && <Button onClick={share} disabled={Boolean(busy)}>{busy === 'share' ? <Loader2 className="animate-spin" /> : <Share2 />} שיתוף מאובטח</Button>}{current.documentFileId && <a href={`https://drive.google.com/open?id=${current.documentFileId}`} target="_blank" rel="noreferrer"><Button variant="outline"><CheckCircle2 /> מסמך מאושר</Button></a>}{current.state === 'approved' && <Button variant="ghost" onClick={() => { navigator.clipboard.writeText(current.currentStatus); toast.success('הסטטוס הועתק') }}><Copy /> העתקת סטטוס</Button>}</div>
      <p className="text-xs text-muted-foreground">חבילת ראיות: {current.evidenceSummary.sheetRows ?? 0} שורות · {current.evidenceSummary.tasks ?? 0} משימות · {current.evidenceSummary.calendarEvents ?? 0} אירועים · {current.evidenceSummary.driveFiles ?? 0} קבצים</p>
    </article>}
  </div>
}

function BriefSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h3 className="mb-2 font-black">{title}</h3>{children}</section> }
function List({ items }: { items: string[] }) { return items.length ? <ul className="space-y-2">{items.map((item, index) => <li key={index} className="rounded-xl bg-muted/50 px-4 py-3 text-sm">{item}</li>)}</ul> : <p className="text-sm text-muted-foreground">אין פריטים</p> }
