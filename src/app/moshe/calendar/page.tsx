import { createClient } from '@supabase/supabase-js'
import { MosheCalendarView } from '@/components/moshe/MosheCalendarView'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'
export const metadata = { title: 'יומן | משה פרוש' }

export default async function MosheCalendarPage() {
  const [
    { data: projPayments },
    { data: buyerPayments },
    { data: buyers },
    { data: projects },
    { data: events },
  ] = await Promise.all([
    db.from('moshe_project_payments').select('*, moshe_projects(name)').order('due_date'),
    db.from('moshe_buyer_payments').select('*, moshe_buyers(name, project_id), moshe_projects(name)').order('due_date'),
    db.from('moshe_buyers').select('id, name'),
    db.from('moshe_projects').select('id, name'),
    db.from('moshe_calendar_events').select('*').order('start_time'),
  ])

  return (
    <MosheCalendarView
      projPayments={(projPayments as any[]) ?? []}
      buyerPayments={(buyerPayments as any[]) ?? []}
      manualEvents={(events as any[]) ?? []}
      projects={(projects as any[]) ?? []}
    />
  )
}
