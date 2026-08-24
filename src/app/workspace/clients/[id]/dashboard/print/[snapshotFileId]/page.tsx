import { notFound } from 'next/navigation'
import { PrintDashboardButton } from '@/components/workspace/PrintDashboardButton'
import { SnapshotDashboardView } from '@/components/workspace/SnapshotDashboardView'
import { assertDriveFolderDescendsFrom } from '@/lib/v2/google-drive-security'
import { loadSnapshotJson } from '@/lib/v2/dashboard-snapshot'
import { getWorkspaceClient } from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'

export default async function PrintDashboardPage({ params }: { params: Promise<{ id: string; snapshotFileId: string }> }) {
  const { id, snapshotFileId } = await params
  const client = await getWorkspaceClient(id)
  if (!client.drive_folder_id) notFound()
  await assertDriveFolderDescendsFrom(snapshotFileId, client.drive_folder_id)
  const snapshot = await loadSnapshotJson(snapshotFileId)
  if (snapshot.clientId !== client.id) notFound()
  return <><SnapshotDashboardView snapshot={snapshot} /><PrintDashboardButton /></>
}
