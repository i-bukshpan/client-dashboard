'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { User, FolderKanban, Search, X, ChevronDown } from 'lucide-react'
import { UndoButton } from '@/components/moshe/UndoButton'

const ENTITY_LABELS: Record<string, string> = {
  project: 'פרויקט',
  buyer: 'קונה',
  transaction: 'עסקה',
  partner: 'שותף',
  partner_transaction: 'תנועת שותף',
  loan: 'הלוואה',
  payment: 'תשלום פרויקט',
  buyer_payment: 'תשלום קונה',
  document: 'מסמך',
  log: 'לוג',
  worker: 'עובד',
  worker_log: 'יומן עובד',
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-600',
}
const ACTION_LABELS: Record<string, string> = {
  create: 'יצירה',
  update: 'עדכון',
  delete: 'מחיקה',
}

const UNDOABLE_TYPES = new Set(['transaction', 'loan', 'payment', 'buyer_payment'])
const PAGE_SIZE = 100

interface Entry {
  id: string
  action_type: string
  entity_type: string
  description: string
  project_id: string | null
  user_email: string | null
  created_at: string
  undo_snapshot: Record<string, unknown> | null
  is_undone: boolean
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
  const [showSnapshotId, setShowSnapshotId] = useState<string | null>(null)

  const now = Date.now()

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
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
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Action type tabs */}
          {(['all', 'create', 'update', 'delete'] as const).map(a => (
            <button
              key={a}
              onClick={() => { setActionFilter(a); setPage(1) }}
              className={cn(
                'text-xs font-bold px-3 py-1.5 rounded-full border transition-colors',
                actionFilter === a
                  ? a === 'all' ? 'bg-slate-800 text-white border-slate-800'
                    : a === 'create' ? 'bg-emerald-500 text-white border-emerald-500'
                    : a === 'update' ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-red-500 text-white border-red-500'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
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
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 appearance-none cursor-pointer focus:outline-none focus:border-violet-300"
            >
              <option value="all">כל הסוגים</option>
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
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 appearance-none cursor-pointer focus:outline-none focus:border-violet-300 max-w-[180px]"
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
              placeholder="חיפוש בתיאור..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-3 py-1.5 focus:outline-none focus:border-violet-300"
              dir="rtl"
            />
          </div>
        </div>

        <p className="text-[10px] text-slate-400">
          {filtered.length === entries.length
            ? `${entries.length} רשומות`
            : `${filtered.length} מתוך ${entries.length} רשומות`}
        </p>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {visible.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-sm">אין תוצאות לסינון הנוכחי</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {visible.map((entry) => {
              const ageMin = (now - new Date(entry.created_at).getTime()) / 60000
              const canUndo =
                UNDOABLE_TYPES.has(entry.entity_type) &&
                !entry.is_undone &&
                ageMin <= 10 &&
                (entry.action_type === 'create' ||
                  ((entry.action_type === 'delete' || entry.action_type === 'update') && !!entry.undo_snapshot))

              return (
                <div key={entry.id} className={cn(
                  'flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors',
                  entry.is_undone && 'opacity-40'
                )}>
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', ACTION_COLORS[entry.action_type] ?? 'bg-slate-100 text-slate-500')}>
                        {ACTION_LABELS[entry.action_type] ?? entry.action_type}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                        {ENTITY_LABELS[entry.entity_type] ?? entry.entity_type}
                      </span>
                      <p className="text-sm text-slate-700 font-medium">{entry.description}</p>
                      {entry.is_undone && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">בוטל</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                      <span className="flex items-center gap-0.5">
                        <User className="w-3 h-3" />
                        {entry.user_email ?? 'משתמש לא ידוע'}
                      </span>
                      {entry.project_id && projectMap[entry.project_id] && (
                        <>
                          <span>·</span>
                          <Link
                            href={`/moshe/projects/${entry.project_id}`}
                            className="flex items-center gap-0.5 text-amber-600 hover:text-amber-700 hover:underline"
                          >
                            <FolderKanban className="w-3 h-3" />
                            {projectMap[entry.project_id]}
                          </Link>
                        </>
                      )}
                      <span>·</span>
                      <span>{format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}</span>
                      {entry.undo_snapshot && (
                        <>
                          <span>·</span>
                          <button
                            onClick={() => setShowSnapshotId(showSnapshotId === entry.id ? null : entry.id)}
                            className="text-violet-600 hover:text-violet-700 font-bold hover:underline"
                          >
                            {showSnapshotId === entry.id ? 'הסתר ערכים קודמים' : 'הצג ערכים קודמים'}
                          </button>
                        </>
                      )}
                    </div>
                    {showSnapshotId === entry.id && entry.undo_snapshot && (
                      <div className="mt-2 p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-mono text-slate-600 max-w-lg overflow-x-auto" dir="ltr">
                        <div className="font-bold mb-1 border-b border-slate-200 pb-1 text-slate-500 font-sans text-right" dir="rtl">הערכים שנשמרו:</div>
                        <table className="w-full text-left">
                          <tbody>
                            {Object.entries(entry.undo_snapshot).map(([key, val]) => {
                              if (['id', 'created_at', 'project_id', 'buyer_id', 'partner_id'].includes(key)) return null
                              let displayVal = String(val)
                              if (val === null || val === undefined) displayVal = 'null'
                              else if (typeof val === 'boolean') displayVal = val ? 'true' : 'false'
                              else if (key === 'amount' || key === 'total_amount') displayVal = `₪${Number(val).toLocaleString('he-IL')}`
                              
                              return (
                                <tr key={key} className="border-b border-slate-100 last:border-0">
                                  <td className="py-0.5 pr-2 font-bold text-slate-500">{key}:</td>
                                  <td className="py-0.5 font-medium">{displayVal}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  {canUndo && <UndoButton auditId={entry.id} />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {hasMore && (
        <div className="text-center">
          <button
            onClick={() => setPage(p => p + 1)}
            className="text-sm text-violet-600 hover:text-violet-800 font-medium px-6 py-2 rounded-xl border border-violet-200 hover:border-violet-300 bg-white transition-colors"
          >
            טען עוד ({filtered.length - page * PAGE_SIZE} נותרו)
          </button>
        </div>
      )}
    </div>
  )
}
