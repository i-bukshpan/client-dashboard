/**
 * /workspace/clients/[id]/notebook — Nehemiah OS v3 Client Notebook
 *
 * AI-first workspace with three-column layout:
 *   Sources | Chat | Studio
 *
 * Server Component — fetches sources, artifacts, and client list on the server, passes to client layout.
 */

import { notFound } from 'next/navigation'
import { getClientNotebookSources } from '@/lib/v2/notebook-sources'
import { listNotebookArtifacts } from '@/lib/v2/notebook-artifacts'
import { WorkspaceAccessError, listWorkspaceClients } from '@/lib/v2/workspace-dal'
import { NotebookLayout } from '@/components/notebook/NotebookLayout'
import type { StudioArtifact } from '@/components/notebook/StudioPanel'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  try {
    const { client } = await getClientNotebookSources(id)
    return {
      title: `מחברת — ${client.name} | Nehemiah OS v3`,
    }
  } catch {
    return { title: 'מחברת לקוח | Nehemiah OS v3' }
  }
}

export default async function ClientNotebookPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let client: any
  let sources: any[]
  let artifacts: StudioArtifact[] = []
  let allClients: Array<{ id: string; name: string }> = []

  try {
    const [result, rawArtifacts, clientsData] = await Promise.all([
      getClientNotebookSources(id),
      listNotebookArtifacts(id),
      listWorkspaceClients().catch(() => []),
    ])
    client = result.client
    sources = result.sources
    allClients = clientsData.map((c) => ({ id: c.id, name: c.name }))
    artifacts = rawArtifacts.map((a) => ({
      id: a.id,
      type: a.artifact_type,
      title: a.title,
      preview: a.content_md ? a.content_md.slice(0, 160) : undefined,
      contentMd: a.content_md,
      contentJson: a.content_json,
      isPinned: a.is_pinned,
      createdAt: a.created_at,
      shareToken: a.share_token,
    }))
  } catch (error) {
    if (
      error instanceof WorkspaceAccessError &&
      ['INVALID_INPUT', 'NOT_FOUND'].includes(error.code)
    ) {
      notFound()
    }
    throw error
  }

  return (
    <NotebookLayout
      sources={sources}
      artifacts={artifacts}
      clientId={client.id}
      clientName={client.name}
      clients={allClients}
      mode="client"
    />
  )
}
