import { Users, Brain, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { AddClientSheet } from '@/components/crm/AddClientSheet'
import { WorkspaceClientCard } from '@/components/workspace/WorkspaceClientCard'
import { listWorkspaceClients } from '@/lib/v2/workspace-dal'

export const metadata = { title: 'לקוחות | Nehemiah Workspace v2' }
export const dynamic = 'force-dynamic'

export default async function WorkspaceClientsPage() {
  const clients = await listWorkspaceClients()

  const pendingOnboarding = clients.filter((c) => {
    const ctx = c.client_context_json
    return !ctx || typeof ctx !== 'object' || !('version' in ctx)
  })

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">לקוחות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clients?.length ?? 0} לקוחות רשומים — ניהול Google Workspace
          </p>
        </div>
        <AddClientSheet />
      </div>

      {/* Onboarding alert banner */}
      {pendingOnboarding.length > 0 && (
        <div dir="rtl" className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5">
          <div className="w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">
              {pendingOnboarding.length} לקוח{pendingOnboarding.length !== 1 ? 'ות' : ''} ממתינ{pendingOnboarding.length !== 1 ? 'ים' : ''} לאפיון ראשוני
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              הסוכן טרם למד על הלקוחות הבאים. פתח כל לקוח ועבור לטאב AI Agent להתחלת תהליך האפיון.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {pendingOnboarding.slice(0, 8).map((c) => (
                <Link
                  key={c.id}
                  href={`/workspace/clients/${c.id}?tab=ai`}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-amber-300 text-amber-700 font-semibold hover:bg-amber-100 transition-colors"
                >
                  {c.name}
                </Link>
              ))}
              {pendingOnboarding.length > 8 && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-600 font-medium">
                  ועוד {pendingOnboarding.length - 8}...
                </span>
              )}
            </div>
          </div>
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-1" />
        </div>
      )}

      {/* Client grid */}
      {!clients || clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-2xl">
          <Users className="w-12 h-12 text-muted-foreground/20 mb-4" />
          <p className="font-semibold text-foreground">אין לקוחות עדיין</p>
          <p className="text-sm text-muted-foreground mt-1">לחץ על &quot;הוסף לקוח&quot; למעלה כדי ליצור לקוח חדש</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((client) => (
            <WorkspaceClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  )
}
