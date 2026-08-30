import { GlobalDailyBriefView } from '@/components/workspace/GlobalDailyBriefView'
import { requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

export const metadata = {
  title: 'בריף יומי מנהלים | Nehemiah OS v2',
  description: 'תמונת מצב יומית וריכוז פעילות רוחבי של כל הלקוחות והמשימות ב-Nehemiah OS',
}

export const dynamic = 'force-dynamic'

export default async function WorkspaceDailyBriefPage() {
  await requireWorkspaceAdmin()
  return <GlobalDailyBriefView />
}

