import { createClient } from '@supabase/supabase-js'
import { ScrollText } from 'lucide-react'
import { ActivityLogClient } from '@/components/moshe/ActivityLogClient'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export default async function ActivityJournalPage() {
  // purge entries older than 7 days
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  await db.from('moshe_audit_log').delete().lt('created_at', cutoff)

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
          <p className="text-xs text-slate-400">מעקב אוטומטי אחרי כל השינויים · ביטול פעולה אפשרי עד 10 דקות · רשומות נמחקות לאחר 7 ימים</p>
        </div>
      </div>

      <ActivityLogClient entries={entries} projectMap={projectMap} />
    </div>
  )
}
