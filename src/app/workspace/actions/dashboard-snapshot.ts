'use server'

import { z } from 'zod'
import { uploadFileToDrive } from '@/lib/google-drive'
import { renderDashboardPdf } from '@/lib/v2/dashboard-pdf'
import {
  buildDashboardSnapshot,
  createDashboardShareGrant,
  saveSnapshotJson,
} from '@/lib/v2/dashboard-snapshot'
import { getWorkspaceClient, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

const ShareInputSchema = z.object({
  clientId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(365).nullable(),
})

async function createArtifacts(clientId: string) {
  const client = await getWorkspaceClient(clientId)
  if (!client.drive_folder_id) throw new Error('לא הוגדרה תיקיית Drive ללקוח')
  const snapshot = await buildDashboardSnapshot(clientId)
  const [snapshotFile, pdfBuffer] = await Promise.all([
    saveSnapshotJson(snapshot),
    renderDashboardPdf(snapshot),
  ])
  const pdf = await uploadFileToDrive(
    client.drive_folder_id,
    `dashboard-${client.name}-${snapshot.generatedAt.slice(0, 10)}.pdf`,
    'application/pdf',
    pdfBuffer
  )
  return { snapshot, snapshotFile, pdf }
}

export async function exportDashboardPdfAction(clientId: string) {
  try {
    await requireWorkspaceAdmin()
    const artifacts = await createArtifacts(clientId)
    return {
      success: true as const,
      pdfFileId: artifacts.pdf.id,
      pdfUrl: artifacts.pdf.webViewLink,
      printUrl: `/workspace/clients/${clientId}/dashboard/print/${artifacts.snapshotFile.id}`,
    }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'ייצוא PDF נכשל' }
  }
}

export async function createDashboardShareAction(rawInput: {
  clientId: string
  expiresInDays: number | null
}) {
  try {
    await requireWorkspaceAdmin()
    const input = ShareInputSchema.parse(rawInput)
    const artifacts = await createArtifacts(input.clientId)
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
      : null
    const grant = await createDashboardShareGrant({
      clientId: input.clientId,
      title: artifacts.snapshot.title,
      snapshotFileId: artifacts.snapshotFile.id,
      pdfFileId: artifacts.pdf.id,
      expiresAt,
    })
    const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    return {
      success: true as const,
      shareId: grant.id,
      shareUrl: `${origin.replace(/\/$/, '')}/share/dashboard/${grant.token}`,
      expiresAt: grant.expiresAt,
    }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'יצירת קישור שיתוף נכשלה' }
  }
}
