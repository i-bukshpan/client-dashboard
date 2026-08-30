'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Copy,
  FileCheck2,
  Loader2,
  MessageCircleQuestion,
  RefreshCw,
  Share2,
  Sparkles,
  Send,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  approveMonthlyBriefAction,
  generateMonthlyBriefAction,
  shareMonthlyBriefAction,
  submitBriefAnswersAction,
} from '@/app/workspace/actions/monthly-brief'
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

  // Interactive Answers State for needs_input
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, { decision: 'clarified' | 'omit' | 'will_provide'; note: string }>>({})

  async function generate() {
    setBusy('generate')
    const result = await generateMonthlyBriefAction(clientId, month)
    setBusy(null)
    if ('error' in result) return toast.error(result.error)
    if (result.brief.state === 'needs_input') {
      toast.warning('הבריף נוצר וממתין להשלמת שאלות כאן למטה')
    } else {
      toast.success('טיוטת הבריף נוצרה בהצלחה!')
    }
    router.refresh()
  }

  async function approve() {
    if (!current) return
    setBusy('approve')
    const result = await approveMonthlyBriefAction(clientId, current.id)
    setBusy(null)
    if ('error' in result) return toast.error(result.error)
    toast.success('הבריף אושר ונשמר ב-Google Drive')
    router.refresh()
  }

  async function share() {
    if (!current) return
    setBusy('share')
    const result = await shareMonthlyBriefAction(clientId, current.id, 30)
    setBusy(null)
    if ('error' in result) return toast.error(result.error)
    await navigator.clipboard.writeText(result.shareUrl)
    toast.success('קישור מאובטח ל-30 יום הועתק')
  }

  async function submitInteractiveAnswers() {
    if (!current || current.missingInformation.length === 0) return
    setBusy('submit-answers')
    const toastId = toast.loading('מעדכן את הבריף עם התשובות שלך...')

    const answersPayload = current.missingInformation.map((item) => {
      const existing = selectedAnswers[item.id]
      return {
        issueId: item.id,
        decision: existing?.decision || 'clarified',
        note: existing?.note || item.options[0] || '',
      }
    })

    const result = await submitBriefAnswersAction(clientId, current.id, answersPayload)
    setBusy(null)

    if ('error' in result) {
      toast.error(result.error, { id: toastId })
    } else {
      toast.success(
        result.brief.state === 'needs_input'
          ? 'התשובות נשמרו! נותרו עוד שאלות למענה.'
          : '✅ הבריף החודשי עודכן בהצלחה ומוכן לאישור!',
        { id: toastId }
      )
      setSelectedAnswers({})
      router.refresh()
    }
  }

  const handleSelectOption = (issueId: string, option: string) => {
    let decision: 'clarified' | 'omit' | 'will_provide' = 'clarified'
    if (option.includes('להשמיט') || option.includes('התעלם') || option.includes('ללא')) {
      decision = 'omit'
    } else if (option.includes('אעדכן') || option.includes('אעלה')) {
      decision = 'will_provide'
    }

    setSelectedAnswers((prev) => ({
      ...prev,
      [issueId]: { decision, note: option },
    }))
  }

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-5 overflow-y-auto p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Sparkles className="text-violet-400" /> הבריף החודשי
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            סיכום מבוסס ראיות מהגיליון, משימות, יומן ו-Drive
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="brief-month">
              חודש דיווח
            </label>
            <Input
              id="brief-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
          <Button onClick={generate} disabled={Boolean(busy)}>
            {busy === 'generate' ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {current?.reportMonth === month ? 'יצירה מחדש' : 'יצירת בריף'}
          </Button>
        </div>
      </header>

      {!current ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          טרם נוצר בריף חודשי לחודש זה. לחץ על "יצירת בריף" כדי להפיק.
        </div>
      ) : (
        <article className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black">בריף {current.reportMonth}</h3>
              <p className="text-xs text-muted-foreground">
                עודכן {new Date(current.updatedAt).toLocaleString('he-IL')}
              </p>
            </div>
            <Badge
              className={
                current.state === 'approved'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : current.state === 'needs_input'
                  ? 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30'
                  : 'bg-indigo-500/15 text-indigo-400'
              }
            >
              {stateLabel[current.state]}
            </Badge>
          </div>

          <BriefSection title="מצב נוכחי">
            <p className="leading-7 whitespace-pre-wrap">{current.currentStatus}</p>
          </BriefSection>

          <BriefSection title="מה בוצע החודש">
            <List items={current.completedThisMonth} />
          </BriefSection>

          <BriefSection title="פעולות ממתינות">
            <List items={current.pendingActions} />
          </BriefSection>

          {/* Interactive Q&A Card inside the Brief Tab */}
          {current.missingInformation.length > 0 && (
            <section className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 shadow-xs">
              <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
                <h3 className="flex items-center gap-2 font-black text-amber-500 text-base">
                  <MessageCircleQuestion className="w-5 h-5 text-amber-500" />
                  שאלות להשלמת הבריף (מענה ישיר של נחמיה)
                </h3>
                <span className="text-xs font-semibold text-amber-600 bg-amber-100 dark:bg-amber-950/40 px-2.5 py-1 rounded-full">
                  {current.missingInformation.length} שאלות פתוחות
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {current.missingInformation.map((item, index) => {
                  const currentSelection = selectedAnswers[item.id]
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border/80 bg-background/80 p-4 space-y-3"
                    >
                      <div className="flex items-start gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-600">
                          {index + 1}
                        </span>
                        <p className="font-semibold text-sm text-foreground leading-snug">
                          {item.question}
                        </p>
                      </div>

                      {/* Clickable Choice Buttons */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {item.options.map((option) => {
                          const isSelected = currentSelection?.note === option
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => handleSelectOption(item.id, option)}
                              className={`
                                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                ${
                                  isSelected
                                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                                    : 'bg-muted/70 hover:bg-muted text-foreground border border-border/60 hover:border-amber-400'
                                }
                              `}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                              {option}
                            </button>
                          )
                        })}
                      </div>

                      {/* Optional Custom Clarification input */}
                      <div className="pt-1">
                        <Input
                          placeholder="או כתוב תשובה מותאמת אישית כאן..."
                          value={currentSelection?.note || ''}
                          onChange={(e) =>
                            setSelectedAnswers((prev) => ({
                              ...prev,
                              [item.id]: { decision: 'clarified', note: e.target.value },
                            }))
                          }
                          className="h-8 text-xs bg-muted/40"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Submit Answers Button */}
              <div className="mt-5 pt-3 border-t border-amber-500/20 flex items-center justify-end gap-3">
                <Button
                  onClick={submitInteractiveAnswers}
                  disabled={busy === 'submit-answers'}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 shadow-sm"
                >
                  {busy === 'submit-answers' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  שמור תשובות ועדכן בריף עכשיו
                </Button>
              </div>
            </section>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {current.state === 'draft' && (
              <Button onClick={approve} disabled={Boolean(busy)}>
                {busy === 'approve' ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
                אישור ושמירה ב-Drive
              </Button>
            )}
            {current.state === 'approved' && (
              <Button onClick={share} disabled={Boolean(busy)}>
                {busy === 'share' ? <Loader2 className="animate-spin" /> : <Share2 />}
                שיתוף מאובטח
              </Button>
            )}
            {current.documentFileId && (
              <a
                href={`https://drive.google.com/open?id=${current.documentFileId}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline">
                  <CheckCircle2 /> מסמך מאושר
                </Button>
              </a>
            )}
            {current.state === 'approved' && (
              <Button
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(current.currentStatus)
                  toast.success('הסטטוס הועתק')
                }}
              >
                <Copy /> העתקת סטטוס
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            חבילת ראיות: {current.evidenceSummary.sheetRows ?? 0} שורות ·{' '}
            {current.evidenceSummary.tasks ?? 0} משימות ·{' '}
            {current.evidenceSummary.calendarEvents ?? 0} אירועים ·{' '}
            {current.evidenceSummary.driveFiles ?? 0} קבצים
          </p>
        </article>
      )}
    </div>
  )
}

function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-black">{title}</h3>
      {children}
    </section>
  )
}

function List({ items }: { items: string[] }) {
  return items.length ? (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
          {item}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">אין פריטים</p>
  )
}
