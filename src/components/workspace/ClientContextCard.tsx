'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Target, Users, Layers, BarChart3, Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ClientContext } from '@/lib/v2/client-context-schema'

interface ClientContextCardProps {
  context: ClientContext
}

export function ClientContextCard({ context }: ClientContextCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-indigo-200 bg-indigo-50/60 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-100/60 transition-colors text-right"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
            <Building2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-indigo-700 leading-tight">פרופיל עסקי</p>
            <p className="text-[10px] text-indigo-500/80 leading-tight truncate max-w-[140px]">
              {context.businessType}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-100 text-emerald-700 border-emerald-200 font-bold">
            נשמר
          </Badge>
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
            : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-indigo-200/60">
          <p className="text-[11px] text-indigo-700/80 pt-2 leading-relaxed">
            {context.businessDescription}
          </p>

          {context.stakeholders.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Users className="w-3 h-3 text-indigo-500" />
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">בעלים ושותפים</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {context.stakeholders.map((s, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-700">
                    {s.name} · {s.role}
                  </span>
                ))}
              </div>
            </div>
          )}

          {context.nehemiahGoals.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Target className="w-3 h-3 text-indigo-500" />
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">מטרות</p>
              </div>
              <ul className="space-y-0.5">
                {context.nehemiahGoals.map((g, i) => (
                  <li key={i} className="text-[10px] text-indigo-700/80 flex items-start gap-1">
                    <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {context.activePhases.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Layers className="w-3 h-3 text-indigo-500" />
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">שלבים פעילים</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {context.activePhases.map((p, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 border border-violet-200 text-violet-700">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {context.keyMetrics.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <BarChart3 className="w-3 h-3 text-indigo-500" />
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">מדדי ניטור</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {context.keyMetrics.map((m, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {context.sheetMapping && (
            <div className="pt-2 border-t border-indigo-200/50 space-y-2">
              <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">מיפוי לשוניות גיליון</p>

              {context.sheetMapping.dashboardSummaryTabs && context.sheetMapping.dashboardSummaryTabs.length > 0 && (
                <div>
                  <p className="text-[9px] text-muted-foreground font-semibold mb-1">לוחות וסיכומי על (Dashboard):</p>
                  <div className="flex flex-wrap gap-1">
                    {context.sheetMapping.dashboardSummaryTabs.map((t, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-100/80 border border-indigo-200 text-indigo-800 font-medium">
                        📊 {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {context.sheetMapping.rawMovementsTabs && context.sheetMapping.rawMovementsTabs.length > 0 && (
                <div>
                  <p className="text-[9px] text-muted-foreground font-semibold mb-1">תנועות גולמיות:</p>
                  <div className="flex flex-wrap gap-1">
                    {context.sheetMapping.rawMovementsTabs.map((t, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-medium">
                        📝 {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {context.sheetMapping.trackingTabs && context.sheetMapping.trackingTabs.length > 0 && (
                <div>
                  <p className="text-[9px] text-muted-foreground font-semibold mb-1">מעקבים ייעודיים:</p>
                  <div className="flex flex-wrap gap-1">
                    {context.sheetMapping.trackingTabs.map((t, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-medium">
                        📌 {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {context.sheetMapping.ignoredTabs && context.sheetMapping.ignoredTabs.length > 0 && (
                <div>
                  <p className="text-[9px] text-muted-foreground font-semibold mb-1">להתעלמות:</p>
                  <div className="flex flex-wrap gap-1">
                    {context.sheetMapping.ignoredTabs.map((t, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 font-medium line-through">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}