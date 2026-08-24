import 'server-only'

import { createV2DriveClient } from '@/lib/v2/google-auth'
import { WorkspaceAccessError } from '@/lib/v2/workspace-dal'

const MAX_PARENT_DEPTH = 20

/** Prevents an authenticated caller from browsing a Drive folder outside a client's root. */
export async function assertDriveFolderDescendsFrom(
  folderId: string,
  rootFolderId: string
): Promise<void> {
  if (folderId === rootFolderId) return

  const drive = createV2DriveClient()
  let frontier = [folderId]
  const visited = new Set<string>()

  for (let depth = 0; depth < MAX_PARENT_DEPTH && frontier.length > 0; depth += 1) {
    const next: string[] = []
    for (const currentId of frontier) {
      if (visited.has(currentId)) continue
      visited.add(currentId)

      const response = await drive.files.get({
        fileId: currentId,
        fields: 'id, parents, trashed',
        supportsAllDrives: true,
      })
      if (response.data.trashed) break

      for (const parentId of response.data.parents ?? []) {
        if (parentId === rootFolderId) return
        next.push(parentId)
      }
    }
    frontier = next
  }

  throw new WorkspaceAccessError('FORBIDDEN', 'תיקיית Drive אינה שייכת ללקוח')
}
