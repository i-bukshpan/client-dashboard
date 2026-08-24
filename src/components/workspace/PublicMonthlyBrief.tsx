import { CheckCircle2, Clock3, Info, ListTodo } from 'lucide-react'
import type { MonthlyBriefRecord } from '@/types/monthly-brief'

export function PublicMonthlyBrief({ brief }: { brief: MonthlyBriefRecord }) {
  return <main dir="rtl" className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100"><article className="mx-auto max-w-4xl space-y-6"><header className="rounded-3xl border border-slate-800 bg-slate-900 p-7"><p className="text-sm font-bold text-indigo-400">Nehemiah OS · בריף חודשי</p><h1 className="mt-2 text-3xl font-black">{brief.clientName}</h1><p className="mt-1 text-slate-400">חודש דיווח: {brief.reportMonth}</p></header><Section icon={Info} title="מצב נוכחי"><p className="leading-8">{brief.currentStatus}</p></Section><Section icon={CheckCircle2} title="מה בוצע החודש"><Items items={brief.completedThisMonth} /></Section><Section icon={ListTodo} title="פעולות ממתינות"><Items items={brief.pendingActions} /></Section><footer className="flex items-center gap-2 text-xs text-slate-500"><Clock3 className="size-3" /> הופק ואושר ב-{new Date(brief.updatedAt).toLocaleString('he-IL')}</footer></article></main>
}

function Section({ icon: Icon, title, children }: { icon: typeof Info; title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Icon className="text-indigo-400" />{title}</h2>{children}</section> }
function Items({ items }: { items: string[] }) { return items.length ? <ul className="space-y-3">{items.map((item, index) => <li key={index} className="rounded-xl bg-slate-800/70 px-4 py-3">{item}</li>)}</ul> : <p className="text-slate-500">אין פריטים</p> }
