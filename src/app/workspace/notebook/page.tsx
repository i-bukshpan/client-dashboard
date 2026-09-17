/**
 * /workspace/notebook — Nehemiah OS v3 Global Notebook
 *
 * Agency-level AI workspace — cross-client queries, global sources, global studio artifacts.
 * Same three-column layout as client notebook, but in global mode.
 */

import { getGlobalNotebookSources } from '@/lib/v2/notebook-sources'
import { listNotebookArtifacts } from '@/lib/v2/notebook-artifacts'
import { listWorkspaceClients } from '@/lib/v2/workspace-dal'
import { NotebookLayout } from '@/components/notebook/NotebookLayout'
import type { StudioArtifact } from '@/components/notebook/StudioPanel'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'מחברת גלובלית | Nehemiah OS v3' }

export default async function GlobalNotebookPage() {
  const [sources, rawArtifacts, clientsData] = await Promise.all([
    getGlobalNotebookSources(),
    listNotebookArtifacts(null),
    listWorkspaceClients().catch(() => []),
  ])

  const allClients = clientsData.map((c) => ({ id: c.id, name: c.name }))

  const artifacts: StudioArtifact[] = rawArtifacts.map((a) => ({
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

  return (
    <NotebookLayout
      sources={sources}
      artifacts={artifacts}
      clients={allClients}
      mode="global"
    />
  )
}
