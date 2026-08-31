import type { DashboardSnapshot } from '@/types/dashboard-snapshot'
import type { DashboardWidget } from '@/types/dashboard'

function numberValue(value: unknown): number {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]+/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function Stat({ widget, snapshot }: { widget: DashboardWidget; snapshot: DashboardSnapshot }) {
  const rows = snapshot.data[widget.sheet] ?? []
  const columnsToSum = widget.value_columns && widget.value_columns.length > 0
    ? widget.value_columns
    : widget.value_column
    ? [widget.value_column]
    : widget.y_column
    ? [widget.y_column]
    : []

  if (widget.aggregation === 'count' || columnsToSum.length === 0) {
    return (
      <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
        {widget.prefix}{rows.length.toLocaleString('he-IL')}{widget.suffix}
      </div>
    )
  }

  let totalSum = 0
  for (const col of columnsToSum) {
    const colValues = rows.map((r) => numberValue(r[col]))
    totalSum += colValues.reduce((sum, item) => sum + item, 0)
  }

  const finalValue =
    widget.aggregation === 'avg'
      ? totalSum / Math.max(rows.length, 1)
      : totalSum

  return (
    <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
      {widget.prefix ?? '₪'}{Math.round(finalValue).toLocaleString('he-IL')}{widget.suffix}
    </div>
  )
}

function TableWidget({ widget, snapshot }: { widget: DashboardWidget; snapshot: DashboardSnapshot }) {
  const rows = snapshot.data[widget.sheet] ?? []
  const columns = (widget.columns?.length ? widget.columns : Object.keys(rows[0] ?? {})).slice(0, 8)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-right border-collapse">
        <thead>
          <tr className="border-b border-border/80 bg-muted/30">
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 text-right font-bold text-muted-foreground">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, widget.max_rows ?? 20).map((row, index) => (
            <tr key={index} className="border-b border-border/40 hover:bg-muted/20">
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 whitespace-nowrap">
                  {row[column] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartBars({ widget, snapshot }: { widget: DashboardWidget; snapshot: DashboardSnapshot }) {
  const rows = snapshot.data[widget.sheet] ?? []
  const label = widget.label_column ?? widget.x_column ?? ''
  const value = widget.value_column ?? widget.y_column ?? ''
  const items = rows.slice(0, 12).map((row) => ({ label: row[label] ?? '', value: numberValue(row[value]) }))
  const max = Math.max(...items.map((item) => Math.abs(item.value)), 1)
  return (
    <div className="space-y-2.5">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="grid grid-cols-[110px_1fr_80px] items-center gap-2 text-xs">
          <span className="truncate font-medium text-muted-foreground text-right">{item.label}</span>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.abs(item.value) / max * 100}%` }} />
          </div>
          <span className="text-left font-mono font-bold" dir="ltr">₪{Math.round(item.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export function SnapshotDashboardView({ snapshot, publicView = false }: { snapshot: DashboardSnapshot; publicView?: boolean }) {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground" dir="rtl">
      <div className="mx-auto max-w-7xl p-6 print:max-w-none print:bg-white print:text-black">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Nehemiah OS v2 · צילום מצב מנהלים
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black text-foreground">{snapshot.title}</h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              הופק בתאריך {new Date(snapshot.generatedAt).toLocaleString('he-IL')}
            </p>
          </div>
          {publicView && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
              ● צילום מצב מאובטח לקריאה בלבד
            </span>
          )}
        </header>
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {snapshot.config.widgets.map((widget) => {
            const spanClass =
              widget.position?.w === 4
                ? 'md:col-span-2 xl:col-span-4'
                : widget.position?.w === 3
                ? 'md:col-span-2 xl:col-span-3'
                : widget.position?.w === 2
                ? 'md:col-span-2'
                : widget.type === 'data_table'
                ? 'md:col-span-2 xl:col-span-4'
                : widget.type === 'stat_card'
                ? 'col-span-1'
                : 'md:col-span-2'

            return (
              <article
                key={widget.id}
                className={`rounded-2xl border border-border/70 bg-card p-5 shadow-xs print:border-slate-300 print:bg-white ${spanClass}`}
              >
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                  <h2 className="font-bold text-sm text-foreground">{widget.title}</h2>
                  <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                    גיליון: {widget.sheet}
                  </span>
                </div>
                {widget.type === 'stat_card' ? (
                  <Stat widget={widget} snapshot={snapshot} />
                ) : widget.type === 'data_table' ? (
                  <TableWidget widget={widget} snapshot={snapshot} />
                ) : (
                  <ChartBars widget={widget} snapshot={snapshot} />
                )}
              </article>
            )
          })}
        </section>
      </div>
    </main>
  )
}
