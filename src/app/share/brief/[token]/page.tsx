import { notFound } from 'next/navigation'
import { PublicMonthlyBrief } from '@/components/workspace/PublicMonthlyBrief'
import { resolvePublicMonthlyBrief } from '@/lib/v2/monthly-brief-share'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'בריף חודשי | Nehemiah OS' }

export default async function MonthlyBriefSharePage({ params }: { params: Promise<{ token: string }> }) {
  const brief = await resolvePublicMonthlyBrief((await params).token)
  if (!brief) notFound()
  return <PublicMonthlyBrief brief={brief} />
}
