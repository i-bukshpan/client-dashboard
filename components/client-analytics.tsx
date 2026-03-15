'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, Sparkles, TrendingUp, ShieldCheck, Loader2, Copy, Share2, AlertCircle } from 'lucide-react'
import { generateClientAIReport, getCashflowInsights } from '@/lib/actions/ai-advanced'
import { getClientHealthIndex } from '@/lib/actions/analytics'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ClientAnalyticsProps {
  clientId: string
}

export function ClientAnalytics({ clientId }: ClientAnalyticsProps) {
  const [report, setReport] = useState<string | null>(null)
  const [insights, setInsights] = useState<string | null>(null)
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [generatingInsights, setGeneratingInsights] = useState(false)

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

  const handleGenerateReport = async () => {
    setGeneratingReport(true)
    const res = await generateClientAIReport(clientId)
    if (res.success) {
      setReport(res.report || null)
      toast.success('דוח AI נוצר בהצלחה')
    } else {
      toast.error('שגיאה ביצירת דוח')
    }
    setGeneratingReport(false)
  }

  const handleGenerateInsights = async () => {
    setGeneratingInsights(true)
    const res = await getCashflowInsights(clientId)
    if (res.success) {
      setInsights(res.insights || null)
      toast.success('תובנות תזרים עודכנו')
    } else {
      toast.error('שגיאה בהפקת תובנות')
    }
    setGeneratingInsights(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('הועתק ללוח')
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

        {/* Action Button Card */}
        <Card className="md:w-72 p-6 flex flex-col justify-center gap-3 bg-navy text-white rounded-3xl shadow-xl shadow-navy/20">
          <p className="text-xs font-bold opacity-70 mb-2">פעולות AI מתקדמות</p>
          <Button 
            onClick={handleGenerateReport} 
            disabled={generatingReport}
            className="w-full rounded-xl bg-white/10 hover:bg-white/20 border-white/10 h-12 gap-2 font-black"
          >
            {generatingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            צור סיכום תקופתי
          </Button>
          <Button 
            onClick={handleGenerateInsights} 
            disabled={generatingInsights}
            className="w-full rounded-xl bg-white/10 hover:bg-white/20 border-white/10 h-12 gap-2 font-black"
          >
            {generatingInsights ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
            תובנות תזרים (AI)
          </Button>
        </Card>
      </div>

      {/* Report Section */}
      {report && (
        <Card className="p-8 bg-white border-2 border-indigo-50 rounded-[2.5rem] shadow-2xl relative animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-black text-navy tracking-tight">סיכום פעילות AI - {new Date().toLocaleDateString('he-IL')}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => copyToClipboard(report)} className="h-9 w-9 rounded-xl hover:bg-slate-100">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="prose prose-slate max-w-none">
            <p className="text-navy font-medium leading-relaxed whitespace-pre-wrap">{report}</p>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
            <AlertCircle className="h-3 w-3" />
            שים לב: דוח זה הופק ע"י בינה מלאכותית ומוגש כהמלצה בלבד
          </div>
        </Card>
      )}

      {/* Insights Section */}
      {insights && (
        <Card className="p-8 bg-emerald-50/30 border-2 border-emerald-100/50 rounded-[2.5rem] shadow-lg animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-black text-emerald-900 tracking-tight">תובנות תזרים וחיזוי</h3>
          </div>
          <div className="p-4 bg-white/50 backdrop-blur-sm rounded-2xl border border-emerald-100">
            <p className="text-emerald-950 font-bold leading-relaxed whitespace-pre-wrap">{insights}</p>
          </div>
        </Card>
      )}

      {!report && !insights && (
        <div className="py-20 text-center space-y-4 opacity-40">
           <BarChart3 className="h-16 w-16 mx-auto text-slate-300" />
           <p className="text-sm font-bold text-slate-500">לחץ על הכפתורים למעלה כדי להפיק תובנות וסיכומי AI</p>
        </div>
      )}
    </div>
  )
}
