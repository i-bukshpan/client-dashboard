import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, MapPin, Phone, User, CalendarDays, DollarSign, Pencil } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ProjectPaymentsTab } from '@/components/moshe/ProjectPaymentsTab'
import { BuyersTab } from '@/components/moshe/BuyersTab'
import { TransactionsTab } from '@/components/moshe/TransactionsTab'
import { DocumentsTab } from '@/components/moshe/DocumentsTab'
import { ProjectPrintButton } from '@/components/moshe/ProjectPrintView'
import { ActivityLogTab } from '@/components/moshe/ActivityLogTab'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:  { label: 'פעיל',  color: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'ממתין', color: 'bg-amber-100 text-amber-700' },
  closed:  { label: 'סגור',  color: 'bg-slate-100 text-slate-500' },
}

export const dynamic = 'force-dynamic'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [
    { data: project },
    { data: projPayments },
    { data: buyers },
    { data: buyerPayments },
    { data: transactions },
    { data: documents },
    { data: activityLogs },
  ] = await Promise.all([
    db.from('moshe_projects').select('*').eq('id', id).single(),
    db.from('moshe_project_payments').select('*').eq('project_id', id).order('due_date', { ascending: true, nullsFirst: false }),
    db.from('moshe_buyers').select('*').eq('project_id', id).order('created_at'),
    db.from('moshe_buyer_payments').select('*').eq('project_id', id),
    db.from('moshe_transactions').select('*').eq('project_id', id).order('date', { ascending: false }),
    db.from('moshe_project_documents').select('*').eq('project_id', id).order('created_at'),
    db.from('moshe_project_logs').select('*').eq('project_id', id).order('created_at', { ascending: false }),
  ])

  if (!project) notFound()

  const p = project as any
  const pp = (projPayments as any[]) ?? []
  const buyersArr = (buyers as any[]) ?? []
  const bp = (buyerPayments as any[]) ?? []
  const tx = (transactions as any[]) ?? []
  const docs = (documents as any[]) ?? []
  const logs = (activityLogs as any[]) ?? []

  // Enrich buyers with their payments
  const buyersWithPayments = buyersArr.map((b: any) => ({
    ...b,
    payments: bp.filter((pay: any) => pay.buyer_id === b.id),
  }))

  // KPIs
  const totalPaid     = pp.filter((x: any) => x.is_paid).reduce((s: number, x: any) => s + Number(x.amount), 0)
  const totalScheduled = pp.reduce((s: number, x: any) => s + Number(x.amount), 0)
  const totalReceived  = bp.filter((x: any) => x.is_received).reduce((s: number, x: any) => s + Number(x.amount), 0)
  const totalExpected  = bp.reduce((s: number, x: any) => s + Number(x.amount), 0)
  const txIncome       = tx.filter((x: any) => x.type === 'income').reduce((s: number, x: any) => s + Number(x.amount), 0)
  const txExpense      = tx.filter((x: any) => x.type === 'expense').reduce((s: number, x: any) => s + Number(x.amount), 0)

  const realBalance    = (totalReceived + txIncome) - (totalPaid + txExpense)
  const expectedBalance = (totalExpected + txIncome) - (totalScheduled + txExpense)

  const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.active

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/moshe/projects" className="hover:text-slate-600 transition-colors">פרויקטים</Link>
        <ArrowRight className="w-4 h-4 rotate-180" />
        <span className="text-slate-700 font-medium">{p.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-amber-400 to-orange-500" />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-xl font-black text-slate-900">{p.name}</h1>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', st.color)}>{st.label}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                {p.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{p.address}</span>}
                {p.contact_name && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{p.contact_name}</span>}
                {p.contact_phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{p.contact_phone}</span>}
                {p.start_date && <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />מ-{format(new Date(p.start_date), 'dd/MM/yyyy')}</span>}
                {p.total_project_cost && <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />תקציב: {fmt(Number(p.total_project_cost))}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ProjectPrintButton
                project={p}
                payments={pp}
                buyers={buyersWithPayments}
                realBalance={realBalance}
                totalReceived={totalReceived + txIncome}
                totalPaid={totalPaid + txExpense}
                totalExpected={totalExpected}
                totalScheduled={totalScheduled}
              />
              <Link
                href={`/moshe/projects/${id}/edit`}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-amber-600 border border-slate-200 hover:border-amber-300 rounded-xl px-3 py-2 transition-all"
              >
                <Pencil className="w-3.5 h-3.5" />
                עריכה
              </Link>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'מאזן אמיתי',   value: fmt(realBalance),    color: realBalance >= 0 ? 'text-emerald-700' : 'text-red-600',  bg: realBalance >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100' },
              { label: 'מאזן צפוי',    value: fmt(expectedBalance), color: expectedBalance >= 0 ? 'text-blue-700' : 'text-orange-600', bg: 'bg-blue-50 border-blue-100' },
              { label: 'הכנסות בפועל', value: fmt(totalReceived + txIncome),  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
              { label: 'הוצאות בפועל', value: fmt(totalPaid + txExpense),     color: 'text-red-600',     bg: 'bg-red-50 border-red-100' },
            ].map(kpi => (
              <div key={kpi.label} className={cn('rounded-xl border p-3 text-center', kpi.bg)}>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{kpi.label}</p>
                <p className={cn('text-base font-black', kpi.color)}>{kpi.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="payments">
        <div className="bg-white border border-border/50 rounded-2xl p-1 mb-4 shadow-sm max-w-fit">
          <TabsList className="bg-transparent gap-1 flex-wrap">
            {[
              { value: 'payments',  label: 'לוח תשלומים' },
              { value: 'buyers',    label: `קונים (${buyersArr.length})` },
              { value: 'finance',   label: 'הוצאות/הכנסות' },
              { value: 'documents', label: `מסמכים (${docs.length})` },
              { value: 'log',       label: `לוג (${logs.length})` },
            ].map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}
                className="rounded-xl px-5 text-sm data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:shadow-none font-bold transition-all">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="payments" className="focus-visible:outline-none">
          <ProjectPaymentsTab projectId={id} payments={pp} />
        </TabsContent>

        <TabsContent value="buyers" className="focus-visible:outline-none">
          <BuyersTab projectId={id} buyers={buyersWithPayments} />
        </TabsContent>

        <TabsContent value="finance" className="focus-visible:outline-none">
          <TransactionsTab projectId={id} transactions={tx} />
        </TabsContent>

        <TabsContent value="documents" className="focus-visible:outline-none">
          <DocumentsTab projectId={id} documents={docs} driveFolderUrl={p.drive_folder_url} />
        </TabsContent>

        <TabsContent value="log" className="focus-visible:outline-none">
          <ActivityLogTab projectId={id} logs={logs} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
