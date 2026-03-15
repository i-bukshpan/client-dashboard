'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  CheckCircle2, Calendar, MessageSquare, 
  Clock, AlertCircle, FileText, UserCog, Wallet 
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { getClientTimeline } from '@/lib/actions/clients'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface UnifiedTimelineProps {
  clientId: string
}

export function UnifiedTimeline({ clientId }: UnifiedTimelineProps) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadTimeline = useCallback(async () => {
    setLoading(true)
    const res = await getClientTimeline(clientId)
    if (res.success) setEvents(res.data)
    setLoading(false)
  }, [clientId])

  useEffect(() => { loadTimeline() }, [loadTimeline])

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-slate-100" />
          <div className="flex-1 h-12 bg-slate-100 rounded-xl" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="relative space-y-8 before:absolute before:inset-0 before:mr-4 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/20 before:via-border/50 before:to-transparent">
      {events.map((event, idx) => (
        <TimelineItem key={idx} event={event} />
      ))}
      
      {events.length === 0 && (
        <div className="text-center py-12 text-muted-foreground italic text-sm">
          אין היסטוריית פעילות ללקוח זה
        </div>
      )}
    </div>
  )
}

function TimelineItem({ event }: { event: any }) {
  const config: any = {
    meeting: {
      icon: Calendar,
      color: 'bg-primary/10 text-primary border-primary/20',
      label: 'פגישה'
    },
    task: {
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      label: 'משימה'
    },
    log: {
      icon: UserCog,
      color: 'bg-slate-50 text-slate-600 border-border/50',
      label: 'פעולה'
    }
  }

  const { icon: Icon, color, label } = config[event.type] || config.log

  return (
    <div className="relative flex items-start gap-4 animate-fade-in-up">
      <div className={cn(
        "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm transition-transform hover:scale-110",
        color
      )}>
        <Icon className="h-4 w-4" />
      </div>

      <Card className="flex-1 p-4 rounded-2xl border-border/50 bg-white/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all group">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-grey/60">
            {label} • {format(new Date(event.date), 'd בMMMM, HH:mm', { locale: he })}
          </span>
        </div>
        
        <h4 className="font-bold text-navy text-sm tracking-tight mb-1">
          {event.subject || event.title || event.description}
        </h4>
        
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <p className="text-xs text-grey leading-relaxed">
            {JSON.stringify(event.metadata).substring(0, 50)}...
          </p>
        )}
      </Card>
    </div>
  )
}
