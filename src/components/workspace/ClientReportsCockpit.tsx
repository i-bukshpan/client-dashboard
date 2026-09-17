'use client'

import React, { useState } from 'react'
import { LayoutGrid, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DashboardEngine } from '@/components/workspace/DashboardEngine'
import { MonthlyBriefPanel } from '@/components/workspace/MonthlyBriefPanel'
import type { DashboardConfig } from '@/types/dashboard'
import type { MonthlyBriefRecord } from '@/types/monthly-brief'

interface ClientReportsCockpitProps {
  clientId: string
  clientName: string
  initialConfig: DashboardConfig | null
  hasSheet: boolean
  briefs: MonthlyBriefRecord[]
  pendingBriefQuestions?: string[]
}

export function ClientReportsCockpit({
  clientId,
  clientName,
  initialConfig,
  hasSheet,
  briefs,
  pendingBriefQuestions = [],
}: ClientReportsCockpitProps) {
  const [activeSubView, setActiveSubView] = useState<'dashboard' | 'brief'>('dashboard')

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* Sub-navigation Switcher */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/50">
          <button
            type="button"
            onClick={() => setActiveSubView('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubView === 'dashboard'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-violet-500" />
            <span>לוח מחוונים (Dashboard)</span>
            {initialConfig && initialConfig.widgets.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-violet-100 text-violet-700">
                {initialConfig.widgets.length}
              </Badge>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('brief')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubView === 'brief'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            <span>תדריך פיננסי חודשי</span>
            {pendingBriefQuestions.length > 0 && (
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Active Content */}
      {activeSubView === 'dashboard' ? (
        <DashboardEngine
          clientId={clientId}
          clientName={clientName}
          initialConfig={initialConfig}
          hasSheet={hasSheet}
        />
      ) : (
        <MonthlyBriefPanel clientId={clientId} briefs={briefs} />
      )}
    </div>
  )
}
