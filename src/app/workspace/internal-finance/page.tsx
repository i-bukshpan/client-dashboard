import { InternalFinanceDashboard } from '@/components/workspace/InternalFinanceDashboard'
import { InternalFinanceSetup } from '@/components/workspace/InternalFinanceSetup'
import { getInternalFinanceDashboard } from '@/lib/v2/internal-finance'

export const metadata = { title: 'כספי הסוכנות | Nehemiah Workspace v2' }
export const dynamic = 'force-dynamic'

export default async function InternalFinancePage() {
  const data = await getInternalFinanceDashboard()
  return <div dir="rtl" className="mx-auto max-w-[1500px] space-y-6 px-5 py-7"><header><h1 className="text-2xl font-black">כספי הסוכנות</h1><p className="mt-1 text-sm text-muted-foreground">ניהול ההכנסות, ההוצאות, הריטיינרים והחשבוניות של נחמיה</p></header>{data.configured ? <InternalFinanceDashboard data={data} /> : <InternalFinanceSetup />}</div>
}
