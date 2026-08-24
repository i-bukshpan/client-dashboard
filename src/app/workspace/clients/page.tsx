import { Users } from 'lucide-react'
import { AddClientSheet } from '@/components/crm/AddClientSheet'
import { WorkspaceClientCard } from '@/components/workspace/WorkspaceClientCard'
import { listWorkspaceClients } from '@/lib/v2/workspace-dal'

export const metadata = { title: 'לקוחות | Nehemiah Workspace v2' }
export const dynamic = 'force-dynamic'

export default async function WorkspaceClientsPage() {
  const clients = await listWorkspaceClients()

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
