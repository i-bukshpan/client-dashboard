'use server'

/**
 * src/app/workspace/actions/artifacts.ts
 *
 * Server Actions for Nehemiah OS v3 Studio Artifacts.
 * Used by the StudioPanel for real-time CRUD, pinning, and sharing.
 */

import { revalidatePath } from 'next/cache'
import {
  saveNotebookArtifact,
  listNotebookArtifacts,
  deleteNotebookArtifact,
  togglePinArtifact,
  createArtifactShareLink,
  type ArtifactType,
  type CreateArtifactInput,
  type NotebookArtifactRecord,
} from '@/lib/v2/notebook-artifacts'

export async function getStudioArtifactsAction(
  clientId?: string | null
): Promise<{ success: boolean; artifacts: NotebookArtifactRecord[]; error?: string }> {
  try {
    const artifacts = await listNotebookArtifacts(clientId)
    return { success: true, artifacts }
  } catch (err: any) {
    return { success: false, artifacts: [], error: err.message }
  }
}

export async function saveStudioArtifactAction(
  input: CreateArtifactInput
): Promise<{ success: boolean; artifact?: NotebookArtifactRecord; error?: string }> {
  try {
    const artifact = await saveNotebookArtifact(input)
    if (input.clientId) {
      revalidatePath(`/workspace/clients/${input.clientId}/notebook`)
    } else {
      revalidatePath('/workspace/notebook')
    }
    return { success: true, artifact }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deleteStudioArtifactAction(
  artifactId: string,
  clientId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteNotebookArtifact(artifactId)
    if (clientId) {
      revalidatePath(`/workspace/clients/${clientId}/notebook`)
    } else {
      revalidatePath('/workspace/notebook')
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function togglePinStudioArtifactAction(
  artifactId: string,
  clientId?: string | null
): Promise<{ success: boolean; isPinned?: boolean; error?: string }> {
  try {
    const isPinned = await togglePinArtifact(artifactId)
    if (clientId) {
      revalidatePath(`/workspace/clients/${clientId}/notebook`)
    } else {
      revalidatePath('/workspace/notebook')
    }
    return { success: true, isPinned }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function createArtifactShareLinkAction(
  artifactId: string
): Promise<{ success: boolean; shareUrl?: string; expiresAt?: string; error?: string }> {
  try {
    const link = await createArtifactShareLink(artifactId)
    return { success: true, shareUrl: link.shareUrl, expiresAt: link.expiresAt }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
