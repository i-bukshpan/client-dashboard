import { notFound } from 'next/navigation'
import { Download } from 'lucide-react'
import { SnapshotDashboardView } from '@/components/workspace/SnapshotDashboardView'
import { resolvePublicDashboardShare } from '@/lib/v2/public-dashboard-share'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'דשבורד משותף | Nehemiah OS' }

export default async function PublicDashboardSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const share = await resolvePublicDashboardShare(token)
  if (!share) notFound()
  return <div className="relative"><SnapshotDashboardView snapshot={share.snapshot} publicView />{share.pdfFileId && <a href={`/api/share/dashboard/${encodeURIComponent(token)}/pdf`} className="fixed bottom-5 left-5 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-xl hover:bg-indigo-500"><Download className="size-4" />הורדת PDF</a>}</div>
}
