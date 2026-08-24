import type { DashboardSnapshot } from '@/types/dashboard-snapshot'
import type { DashboardWidget } from '@/types/dashboard'

function numberValue(value: unknown): number {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]+/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function Stat({ widget, snapshot }: { widget: DashboardWidget; snapshot: DashboardSnapshot }) {
  const rows = snapshot.data[widget.sheet] ?? []
  const column = widget.value_column ?? widget.y_column
  const value = widget.aggregation === 'count' || !column
    ? rows.length
    : rows.reduce((sum, row) => sum + numberValue(row[column]), 0)
  return <div className="text-3xl font-black text-indigo-400">{widget.prefix}{value.toLocaleString('he-IL')}{widget.suffix}</div>
}

function TableWidget({ widget, snapshot }: { widget: DashboardWidget; snapshot: DashboardSnapshot }) {
  const rows = snapshot.data[widget.sheet] ?? []
  const columns = (widget.columns?.length ? widget.columns : Object.keys(rows[0] ?? {})).slice(0, 8)
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{columns.map((column) => <th key={column} className="border-b border-white/10 px-3 py-2 text-right text-slate-400">{column}</th>)}</tr></thead><tbody>{rows.slice(0, widget.max_rows ?? 20).map((row, index) => <tr key={index}>{columns.map((column) => <td key={column} className="border-b border-white/5 px-3 py-2">{row[column]}</td>)}</tr>)}</tbody></table></div>
}

function ChartBars({ widget, snapshot }: { widget: DashboardWidget; snapshot: DashboardSnapshot }) {
  const rows = snapshot.data[widget.sheet] ?? []
  const label = widget.label_column ?? widget.x_column ?? ''
  const value = widget.value_column ?? widget.y_column ?? ''
  const items = rows.slice(0, 12).map((row) => ({ label: row[label] ?? '', value: numberValue(row[value]) }))
  const max = Math.max(...items.map((item) => Math.abs(item.value)), 1)
  return <div className="space-y-2">{items.map((item, index) => <div key={`${item.label}-${index}`} className="grid grid-cols-[100px_1fr_80px] items-center gap-2 text-xs"><span className="truncate text-slate-400">{item.label}</span><div className="h-2 rounded-full bg-white/5"><div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.abs(item.value) / max * 100}%` }} /></div><span dir="ltr">{item.value.toLocaleString()}</span></div>)}</div>
}

export function SnapshotDashboardView({ snapshot, publicView = false }: { snapshot: DashboardSnapshot; publicView?: boolean }) {
  return <main className="min-h-screen bg-slate-950 text-slate-100" dir="rtl"><div className="mx-auto max-w-7xl p-6 print:max-w-none print:bg-white print:text-black"><header className="mb-6 flex items-end justify-between border-b border-white/10 pb-5"><div><div className="text-xs font-bold uppercase tracking-widest text-indigo-400">Nehemiah OS v2</div><h1 className="mt-1 text-3xl font-black">{snapshot.title}</h1><p className="mt-1 text-sm text-slate-400">נוצר בתאריך {new Date(snapshot.generatedAt).toLocaleString('he-IL')}</p></div>{publicView && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">צילום מצב לקריאה בלבד</span>}</header><section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{snapshot.config.widgets.map((widget) => <article key={widget.id} className={`rounded-2xl border border-white/10 bg-slate-900 p-4 print:border-slate-200 print:bg-white ${widget.type === 'data_table' ? 'md:col-span-2 xl:col-span-4' : widget.type === 'stat_card' ? '' : 'md:col-span-2'}`}><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">{widget.title}</h2><span className="text-[10px] text-slate-500">{widget.sheet}</span></div>{widget.type === 'stat_card' ? <Stat widget={widget} snapshot={snapshot} /> : widget.type === 'data_table' ? <TableWidget widget={widget} snapshot={snapshot} /> : <ChartBars widget={widget} snapshot={snapshot} />}</article>)}</section></div></main>
}
