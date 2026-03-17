'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, ShieldCheck, Loader2, AlertCircle } from 'lucide-react'
import { getClientHealthIndex } from '@/lib/actions/analytics'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ClientAnalyticsProps {
  clientId: string
}

export function ClientAnalytics({ clientId }: ClientAnalyticsProps) {
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [clientId])

  const loadAnalytics = async () => {
    setLoading(true)
    const healthRes = await getClientHealthIndex(clientId)
    if (healthRes.success) {
      setHealth(healthRes)
    }
    setLoading(false)
  }

  if (loading) {
    return <div className="py-12 text-center animate-pulse text-grey">מנתח נתוני לקוח...</div>
  }

  return (
    <div className="space-y-8 animate-fade-in" dir="rtl">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Health Score Card */}
        <Card className="flex-1 p-6 bg-white/70 backdrop-blur-xl border-border/50 rounded-3xl shadow-xl shadow-navy/5 overflow-hidden relative">
          <div className={cn(
            "absolute top-0 right-0 w-2 h-full",
            health?.color === 'emerald' ? "bg-emerald-500" : 
            health?.color === 'amber' ? "bg-amber-500" : "bg-rose-500"
          )} />
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-navy flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-500" />
              מדד בריאות לקוח
            </h3>
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md",
              health?.color === 'emerald' ? "bg-emerald-50 text-emerald-700" : 
              health?.color === 'amber' ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
            )}>
              {health?.status}
            </span>
          </div>
          
          <div className="flex items-end gap-3 mb-6">
            <span className="text-5xl font-black text-navy tracking-tighter">{health?.score}</span>
            <span className="text-sm font-bold text-grey pb-1">מתוך 100</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
             <div className="p-3 bg-slate-50 rounded-2xl text-center">
                <p className="text-[10px] font-bold text-grey uppercase mb-1">משימות</p>
                <p className="text-lg font-black text-navy">{health?.details?.openTasks}</p>
             </div>
             <div className="p-3 bg-slate-50 rounded-2xl text-center">
                <p className="text-[10px] font-bold text-grey uppercase mb-1">באיחור</p>
                <p className="text-lg font-black text-rose-600">{health?.details?.overdueTasks}</p>
             </div>
             <div className="p-3 bg-slate-50 rounded-2xl text-center">
                <p className="text-[10px] font-bold text-grey uppercase mb-1">תשלומים</p>
                <p className="text-lg font-black text-amber-600">{health?.details?.unpaidPayments}</p>
             </div>
          </div>
        </Card>

        {/* Info Card instead of AI actions */}
        <Card className="md:w-72 p-6 flex flex-col justify-center gap-3 bg-navy text-white rounded-3xl shadow-xl shadow-navy/20">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-5 w-5 text-indigo-400" />
            <p className="text-sm font-bold">ניתוח נתונים</p>
          </div>
          <p className="text-xs font-medium opacity-80 leading-relaxed">
            כאן תוכל לצפות במדדי הבריאות של הלקוח המבוססים על משימות פתוחות, איחורים ותשלומים ממתינים.
          </p>
        </Card>
      </div>

      <div className="py-20 text-center space-y-4 opacity-40">
         <BarChart3 className="h-16 w-16 mx-auto text-slate-300" />
         <p className="text-sm font-bold text-slate-500">נתוני האנליטיקה מתעדכנים בזמן אמת על סמך פעילות הלקוח</p>
      </div>
    </div>
  )
}
