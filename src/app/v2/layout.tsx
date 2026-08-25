import { redirect } from 'next/navigation'
import {
  requireWorkspaceAdmin,
  WorkspaceAccessError,
} from '@/lib/v2/workspace-dal'

export default async function V2Layout({ children }: { children: React.ReactNode }) {
  try {
    await requireWorkspaceAdmin()
  } catch (error) {
    if (error instanceof WorkspaceAccessError && error.code === 'FORBIDDEN') {
      redirect('/employee/dashboard')
    }
    redirect('/login')
  }

  return children
}
