import { createClient } from '@/lib/supabase/server'
import { Users } from 'lucide-react'
import { AddClientSheet } from '@/components/crm/AddClientSheet'
import { ClientCard } from '@/components/crm/ClientCard'

export const metadata = { title: 'לקוחות (CRM) | Nehemiah OS' }

export default async function CRMPage() {
  const supabase = await createClient()
  const [{ data: clients }, { data: tasks }, { data: appointments }] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('client_id, status'),
    supabase.from('appointments').select('client_id, start_time').order('start_time', { ascending: false }),
  ])

  const openTasksByClient: Record<string, number> = {}
  for (const t of (tasks as any[]) ?? []) {
    if (t.status !== 'done') {
      openTasksByClient[t.client_id] = (openTasksByClient[t.client_id] || 0) + 1
    }
  }

  const lastApptByClient: Record<string, string> = {}
  for (const a of (appointments as any[]) ?? []) {
    if (!lastApptByClient[a.client_id]) {
      lastApptByClient[a.client_id] = a.start_time
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-inner">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-xl text-foreground">ניהול לקוחות</h2>
            <p className="text-muted-foreground text-sm">{clients?.length ?? 0} לקוחות רשומים</p>
          </div>
        </div>
        <AddClientSheet />
      </div>

      {/* Client Grid */}
      {!clients || clients.length === 0 ? (
        <div className="text-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">אין לקוחות עדיין. לחץ "הוסף לקוח" כדי להתחיל.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(clients as any[]).map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              openTasks={openTasksByClient[client.id] || 0}
              lastAppt={lastApptByClient[client.id] || null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
