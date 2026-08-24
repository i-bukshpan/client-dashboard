import { WorkspaceCalendar } from '@/components/workspace/WorkspaceCalendar'
import { listWorkspaceClients } from '@/lib/v2/workspace-dal'

export const metadata = { title: 'יומן | Nehemiah Workspace v2' }
export const dynamic = 'force-dynamic'

export default async function WorkspaceCalendarPage() {
  const clients = await listWorkspaceClients()
  return (
    <div className="h-[calc(100vh-3.5rem)] p-5" dir="rtl">
      <WorkspaceCalendar clients={clients.map(({ id, name, email }) => ({ id, name, email }))} />
    </div>
  )
}
