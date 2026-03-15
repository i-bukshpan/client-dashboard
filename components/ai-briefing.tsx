'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Sparkles, Loader2, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

import { getDashboardBriefing } from '@/lib/actions/dashboard'

interface AIBriefingProps {
  data: any
  onOpenAnalysis?: () => void
}

export function AIBriefing({ data, onOpenAnalysis }: AIBriefingProps) {
  const [briefing, setBriefing] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const generateBriefing = async () => {
      setLoading(true)
      const res = await getDashboardBriefing(data)
      if (res.success && res.text) {
        setBriefing(res.text)
      } else {
        setBriefing('בוקר טוב נחמיה! מוכן להתחיל את היום?')
      }
      setLoading(false)
    }

    if (data) generateBriefing()
  }, [data])

  return (
    <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary/5 via-indigo-50/30 to-background p-6 shadow-sm group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Sparkles className="h-24 w-24 text-primary" />
      </div>
      
      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary/80">תובנות בוקר AI</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-muted-foreground animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p className="text-sm">מנתח את נתוני היום שלך...</p>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <p className="text-base md:text-lg font-medium leading-relaxed text-navy max-w-3xl">
              {briefing}
            </p>
            <button 
              onClick={onOpenAnalysis}
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline group/btn"
            >
              לניתוח המלא 
              <ChevronLeft className="h-3 w-3 transition-transform group-hover/btn:-translate-x-1" />
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}
