import { ExternalLink } from 'lucide-react'
import { OperationsSetup } from '@/components/workspace/OperationsSetup'
import { WorkspaceTaskBoard } from '@/components/workspace/WorkspaceTaskBoard'
import { getOperationsWorkspaceSettings, listWorkspaceTasks } from '@/lib/v2/workspace-tasks'
import { listWorkspaceClients } from '@/lib/v2/workspace-dal'

export const metadata = { title: 'משימות | Nehemiah Workspace v2' }
export const dynamic = 'force-dynamic'

export default async function WorkspaceTasksPage() {
  const [settings, clients] = await Promise.all([getOperationsWorkspaceSettings(), listWorkspaceClients()])
  const tasks = settings ? await listWorkspaceTasks() : []
  return <div dir="rtl" className="mx-auto max-w-[1500px] space-y-6 px-5 py-7"><header className="flex items-end justify-between"><div><h1 className="text-2xl font-black">משימות ותזכורות</h1><p className="mt-1 text-sm text-muted-foreground">ניהול תפעולי מרכזי מתוך Google Sheets</p></div>{settings && <a className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline" href={`https://docs.google.com/spreadsheets/d/${settings.workbookId}`} target="_blank" rel="noreferrer"><ExternalLink className="size-3" /> פתיחת Nehemiah Operations</a>}</header>{settings ? <WorkspaceTaskBoard tasks={tasks} clients={clients.map(({ id, name }) => ({ id, name }))} /> : <OperationsSetup />}</div>
}
