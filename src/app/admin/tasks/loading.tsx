import { Skeleton } from '@/components/ui/skeleton'

export default function TasksLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-10 rounded-xl" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-border/50 rounded-xl p-4 bg-card space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-3/4" />
                <div className="flex items-center gap-2">
                  <Skeleton className="w-6 h-6 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
