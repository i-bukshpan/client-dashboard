import { requireWorkspaceAdmin, listWorkspaceClients } from '@/lib/v2/workspace-dal'
import { GlobalEmailsView } from '@/components/workspace/GlobalEmailsView'

export const metadata = {
  title: 'דוא״ל נחמיה | Nehemiah OS v2',
  description: 'תיבת דואר מרכזית Gmail, מעקב הודעות שלא נקראו ושליחת מענה',
}

export const dynamic = 'force-dynamic'

export default async function WorkspaceEmailsPage() {
  await requireWorkspaceAdmin()
  const clients = await listWorkspaceClients()

  const clientList = clients.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    gmail_label: c.gmail_label,
  }))

  return <GlobalEmailsView clients={clientList} />
}
