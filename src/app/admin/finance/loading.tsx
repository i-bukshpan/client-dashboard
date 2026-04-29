import { Skeleton } from '@/components/ui/skeleton'

export default function FinanceLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-border/50 rounded-2xl p-5 bg-card space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
