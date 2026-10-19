'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { User, FolderKanban, Search, X, ChevronDown, History, RotateCcw, CheckCircle2 } from 'lucide-react'
import { UndoButton } from '@/components/moshe/UndoButton'
import { AuditDiffModal } from '@/components/moshe/AuditDiffModal'
import { Button } from '@/components/ui/button'

const ENTITY_LABELS: Record<string, string> = {
  project: 'פרויקט',
  buyer: 'קונה',
  transaction: 'עסקה',
  partner: 'שותף',
  partner_transaction: 'תנועת שותף',
  loan: 'הלוואה',
  loan_payment: 'תשלום הלוואה',
  loan_receipt: 'קבלה על הלוואה',
  payment: 'תשלום / תנועת פרויקט',
  buyer_payment: 'תשלום / תנועת קונה',
  neighbor: 'שכן',
  neighbor_payment: 'תשלום שכן',
  document: 'מסמך',
  log: 'לוג',
  worker: 'עובד',
  worker_log: 'יומן עובד',
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  update: 'bg-blue-100 text-blue-800 border-blue-200',
  delete: 'bg-red-100 text-red-800 border-red-200',
  restore: 'bg-purple-100 text-purple-800 border-purple-200',
}

const ACTION_LABELS: Record<string, string> = {
  create: 'יצירה',
  update: 'עדכון',
  delete: 'מחיקה',
  restore: 'שחזור',
}

const PAGE_SIZE = 100

interface Entry {
  id: string
  action_type: string
  entity_type: string
  description: string
  project_id: string | null
  user_email: string | null
  created_at: string
  previous_snapshot?: Record<string, unknown> | null
  new_snapshot?: Record<string, unknown> | null
  undo_snapshot?: Record<string, unknown> | null
  is_undone: boolean
  undone_at?: string | null
}

interface Props {
  entries: Entry[]
  projectMap: Record<string, string>
}

export function ActivityLogClient({ entries, projectMap }: Props) {
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [diffModalAuditId, setDiffModalAuditId] = useState<string | null>(null)

  const entityTypes = useMemo(() => {
    const set = new Set(entries.map(e => e.entity_type))
    return Array.from(set).sort()
  }, [entries])

  const projectIds = useMemo(() => {
    const set = new Set(entries.map(e => e.project_id).filter(Boolean) as string[])
    return Array.from(set)
  }, [entries])

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (actionFilter !== 'all' && e.action_type !== actionFilter) return false
      if (entityFilter !== 'all' && e.entity_type !== entityFilter) return false
      if (projectFilter !== 'all' && e.project_id !== projectFilter) return false
      if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [entries, actionFilter, entityFilter, projectFilter, search])

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = page * PAGE_SIZE < filtered.length

  const clearFilters = () => {
    setActionFilter('all')
    setEntityFilter('all')
    setProjectFilter('all')
    setSearch('')
    setPage(1)
  }
  const isFiltered = actionFilter !== 'all' || entityFilter !== 'all' || projectFilter !== 'all' || search !== ''

  return (
    <div className="space-y-4">
      <AuditDiffModal
        auditId={diffModalAuditId}
        onClose={() => setDiffModalAuditId(null)}
      />

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Action type tabs */}
          {(['all', 'create', 'update', 'delete', 'restore'] as const).map(a => (
            <button
              key={a}
              onClick={() => { setActionFilter(a); setPage(1) }}
              className={cn(
                'text-xs font-bold px-3 py-1.5 rounded-full border transition-colors',
                actionFilter === a
                  ? a === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : a === 'create' ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : a === 'update' ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : a === 'restore' ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                    : 'bg-red-600 text-white border-red-600 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              )}
            >
              {a === 'all' ? 'הכל' : ACTION_LABELS[a]}
            </button>
          ))}

          {isFiltered && (
            <button
              onClick={clearFilters}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mr-auto"
            >
              <X className="w-3.5 h-3.5" /> נקה סינון
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Entity type dropdown */}
          <div className="relative">
            <select
              value={entityFilter}
              onChange={e => { setEntityFilter(e.target.value); setPage(1) }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 appearance-none cursor-pointer focus:outline-none focus:border-violet-400"
            >
              <option value="all">כל הישויות</option>
              {entityTypes.map(t => (
                <option key={t} value={t}>{ENTITY_LABELS[t] ?? t}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Project dropdown */}
          {projectIds.length > 0 && (
            <div className="relative">
              <select
                value={projectFilter}
                onChange={e => { setProjectFilter(e.target.value); setPage(1) }}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 appearance-none cursor-pointer focus:outline-none focus:border-violet-400 max-w-[180px]"
              >
                <option value="all">כל הפרויקטים</option>
                {projectIds.map(pid => (
                  <option key={pid} value={pid}>{projectMap[pid] ?? pid}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="חיפוש בפעולות שבוצעו..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-3 py-1.5 focus:outline-none focus:border-violet-400"
              dir="rtl"
            />
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          {filtered.length === entries.length
            ? `${entries.length} רשומות בהיסטוריה`
            : `${filtered.length} מתוך ${entries.length} רשומות בהיסטוריה`}
        </p>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {visible.length === 0 ? (
          <div className="text-center py-16">
            <History className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">אין תוצאות לסינון הנוכחי</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visible.map((entry) => {
              return (
                <div
                  key={entry.id}
                  className={cn(
                    'flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/70 transition-colors',
                    entry.is_undone && 'opacity-60 bg-slate-50/40'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                    <History className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-[10px] font-bold px-2.5 py-0.5 rounded-full border', ACTION_COLORS[entry.action_type] ?? 'bg-slate-100 text-slate-500 border-slate-200')}>
                        {ACTION_LABELS[entry.action_type] ?? entry.action_type}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-bold">
                        {ENTITY_LABELS[entry.entity_type] ?? entry.entity_type}
                      </span>
                      <p className="text-sm text-slate-800 font-semibold">{entry.description}</p>
                      {entry.is_undone && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-purple-600" />
                          שוחזר
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-500">
                        <User className="w-3 h-3 text-slate-400" />
                        {entry.user_email ?? 'משה'}
                      </span>
                      {entry.project_id && projectMap[entry.project_id] && (
                        <>
                          <span>·</span>
                          <Link
                            href={`/moshe/projects/${entry.project_id}`}
                            className="flex items-center gap-1 text-amber-600 hover:text-amber-700 hover:underline font-medium"
                          >
                            <FolderKanban className="w-3 h-3" />
                            {projectMap[entry.project_id]}
                          </Link>
                        </>
                      )}
                      <span>·</span>
                      <span>{format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDiffModalAuditId(entry.id)}
                      className="h-8 text-xs gap-1.5 border-slate-200 text-slate-700 hover:text-violet-700 hover:bg-violet-50 hover:border-violet-300 font-semibold shadow-2xs"
                    >
                      <History className="w-3.5 h-3.5 text-violet-600" />
                      <span>השוואה ושחזור</span>
                    </Button>

                    {!entry.is_undone && (
                      <UndoButton auditId={entry.id} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {hasMore && (
        <div className="text-center pt-2">
          <button
            onClick={() => setPage(p => p + 1)}
            className="text-xs text-violet-700 font-bold px-6 py-2 rounded-xl border border-violet-200 hover:border-violet-300 bg-white hover:bg-violet-50 transition-colors shadow-2xs"
          >
            טען עוד ({filtered.length - page * PAGE_SIZE} נותרו)
          </button>
        </div>
      )}
    </div>
  )
}
