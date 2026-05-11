import { createClient } from '@supabase/supabase-js'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { ScrollText, User, FolderKanban } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

const ENTITY_LABELS: Record<string, string> = {
  project: 'פרויקט',
  buyer: 'קונה',
  transaction: 'עסקה',
  partner: 'שותף',
  partner_transaction: 'תנועת שותף',
  loan: 'הלוואה',
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

export default async function ActivityJournalPage() {
  const [{ data: logs }, { data: projects }] = await Promise.all([
    db.from('moshe_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('moshe_projects').select('id, name'),
  ])

  const entries = (logs as any[]) ?? []
  const projectMap = Object.fromEntries(((projects as any[]) ?? []).map((p: any) => [p.id, p.name]))

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
          <ScrollText className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-lg font-black text-slate-900">יומן פעילות מערכת</h1>
          <p className="text-xs text-slate-400">מעקב אוטומטי אחרי כל השינויים שבוצעו</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {entries.length === 0 ? (
          <div className="text-center py-16">
            <ScrollText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">אין פעולות מתועדות עדיין</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {entries.map((entry: any) => (
              <div key={entry.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
