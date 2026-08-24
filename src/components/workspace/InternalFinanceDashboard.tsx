import { ExternalLink, FileText, Receipt, TrendingDown, TrendingUp, WalletCards } from 'lucide-react'
import { InternalFinanceAI } from '@/components/workspace/InternalFinanceAI'
import { Badge } from '@/components/ui/badge'
import type { InternalFinanceDashboardData } from '@/types/internal-finance'

function money(value: number): string { return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(value) }

function DataTable({ title, rows, columns }: { title: string; rows: Record<string, string>[]; columns: string[] }) {
  return <section className="overflow-hidden rounded-2xl border border-border bg-card"><header className="border-b border-border px-4 py-3 font-bold">{title}</header><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-muted-foreground"><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap px-4 py-2 text-right font-medium">{column}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row['מזהה'] || index} className="border-t border-border/60">{columns.map((column) => <td key={column} className="whitespace-nowrap px-4 py-3">{row[column] || '—'}</td>)}</tr>) : <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">אין רשומות</td></tr>}</tbody></table></div></section>
}

export function InternalFinanceDashboard({ data }: { data: InternalFinanceDashboardData }) {
  const cards = [
    { label: 'סה״כ הכנסות', value: money(data.totals.income), icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'סה״כ הוצאות', value: money(data.totals.expenses), icon: TrendingDown, color: 'text-rose-400' },
    { label: 'רווח', value: money(data.totals.profit), icon: WalletCards, color: data.totals.profit >= 0 ? 'text-indigo-400' : 'text-rose-400' },
    { label: 'חשבוניות פתוחות', value: money(data.totals.openInvoices), icon: FileText, color: 'text-amber-400' },
    { label: 'ריטיינרים פעילים', value: String(data.totals.activeRetainers), icon: Receipt, color: 'text-cyan-400' },
  ]
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-3"><Badge variant="secondary">Google Sheets · מקור אמת</Badge><a className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline" href={`https://docs.google.com/spreadsheets/d/${data.settings?.workbookId}`} target="_blank" rel="noreferrer"><ExternalLink className="size-3" /> פתיחת הגיליון</a><a className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline" href={`https://drive.google.com/drive/folders/${data.settings?.driveFolderId}`} target="_blank" rel="noreferrer"><ExternalLink className="size-3" /> תיקיית Drive</a></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map(({ label, value, icon: Icon, color }) => <div key={label} className="rounded-2xl border border-border bg-card p-4"><div className={`flex items-center gap-2 text-sm ${color}`}><Icon className="size-4" />{label}</div><p className="mt-3 text-2xl font-black">{value}</p></div>)}</div>
    <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]"><div className="space-y-6"><DataTable title="סיכום חודשי" rows={data.monthlySummary} columns={['חודש', 'הכנסות', 'הוצאות', 'רווח', 'שיעור רווח']} /><DataTable title="הכנסות אחרונות" rows={data.recentIncome} columns={['תאריך', 'לקוח', 'תיאור', 'סכום כולל', 'סטטוס']} /><DataTable title="הוצאות אחרונות" rows={data.recentExpenses} columns={['תאריך', 'ספק', 'קטגוריה', 'סכום כולל', 'אסמכתא']} /><DataTable title="חשבוניות" rows={data.invoices} columns={['מספר חשבונית', 'לקוח', 'תאריך פירעון', 'סכום כולל', 'סטטוס']} /></div><InternalFinanceAI /></div>
  </div>
}
