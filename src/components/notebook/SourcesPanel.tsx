'use client'

/**
 * SourcesPanel — Left column of the Notebook layout.
 * Displays all connected data sources for the current client/global context.
 *
 * Fully Interactive:
 * - Direct Google Sheets / Drive / Gmail / Dashboard links (opens in new tab)
 * - "Ask AI" buttons on each source (sends contextual prompt into chat)
 * - Source Details Modal with live status and metadata
 * - Client & Mode Switcher dropdown
 * - Document & Audio recording uploaders
 */

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  TableIcon,
  Mail,
  CalendarDays,
  FileText,
  FolderOpen,
  ShieldCheck,
  Mic2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Database,
  ExternalLink,
  MessageSquare,
  Sparkles,
  LayoutDashboard,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { NotebookSource, NotebookSourceType, NotebookSourceStatus } from '@/lib/v2/notebook-sources'
import { DocumentUploader } from '@/components/notebook/DocumentUploader'
import { RecordingUploader } from '@/components/notebook/RecordingUploader'

// ── Visual config per source type ──────────────────────────────────────────────

const SOURCE_TYPE_CONFIG: Record<
  NotebookSourceType,
  { icon: React.ElementType; color: string; gradient: string; border: string; glow: string; label: string }
> = {
  sheet:        { icon: TableIcon,    color: 'text-emerald-500', gradient: 'from-emerald-500/15 via-emerald-500/5 to-transparent', border: 'border-emerald-500/25 hover:border-emerald-500/60', glow: 'hover:shadow-emerald-500/10', label: 'Google Sheets' },
  drive_folder: { icon: FolderOpen,  color: 'text-sky-500',     gradient: 'from-sky-500/15 via-sky-500/5 to-transparent',         border: 'border-sky-500/25 hover:border-sky-500/60',         glow: 'hover:shadow-sky-500/10',     label: 'Google Drive' },
  gmail:        { icon: Mail,        color: 'text-rose-500',    gradient: 'from-rose-500/15 via-rose-500/5 to-transparent',       border: 'border-rose-500/25 hover:border-rose-500/60',       glow: 'hover:shadow-rose-500/10',    label: 'Gmail' },
  calendar:     { icon: CalendarDays, color: 'text-blue-500',   gradient: 'from-blue-500/15 via-blue-500/5 to-transparent',       border: 'border-blue-500/25 hover:border-blue-500/60',       glow: 'hover:shadow-blue-500/10',    label: 'יומן פגישות' },
  document:     { icon: FileText,    color: 'text-amber-500',   gradient: 'from-amber-500/15 via-amber-500/5 to-transparent',     border: 'border-amber-500/25 hover:border-amber-500/60',     glow: 'hover:shadow-amber-500/10',   label: 'מסמכים סרוקים' },
  recording:    { icon: Mic2,        color: 'text-purple-500',  gradient: 'from-purple-500/15 via-purple-500/5 to-transparent',   border: 'border-purple-500/25 hover:border-purple-500/60',   glow: 'hover:shadow-purple-500/10',  label: 'הקלטות ותמלולים' },
  vault:        { icon: ShieldCheck, color: 'text-violet-500',  gradient: 'from-violet-500/15 via-violet-500/5 to-transparent',   border: 'border-violet-500/25 hover:border-violet-500/60',   glow: 'hover:shadow-violet-500/10',  label: 'כספת פיננסית' },
}

const STATUS_CONFIG: Record<NotebookSourceStatus, { dot: string; label: string }> = {
  connected:      { dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]', label: 'מחובר' },
  syncing:        { dot: 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]', label: 'מסנכרן...' },
  error:          { dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]', label: 'שגיאה' },
  not_configured: { dot: 'bg-slate-400', label: 'לא מוגדר' },
}

// ── SourceItem ──────────────────────────────────────────────────────────────────

function SourceItem({
  source,
  onClick,
  onPrompt,
}: {
  source: NotebookSource
  onClick: (source: NotebookSource) => void
  onPrompt?: (prompt: string) => void
}) {
  const typeConfig = SOURCE_TYPE_CONFIG[source.type] || SOURCE_TYPE_CONFIG.sheet
  const statusConfig = STATUS_CONFIG[source.status] || STATUS_CONFIG.connected
  const Icon = typeConfig.icon

  return (
    <div
      onClick={() => onClick(source)}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
        bg-gradient-to-l ${typeConfig.gradient}
        border ${typeConfig.border}
        ${typeConfig.glow}
        hover:shadow-md
        transition-all duration-200 cursor-pointer text-right group relative backdrop-blur-xs`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-background/90 shadow-2xs ${typeConfig.color}`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-bold text-foreground truncate">
            {source.label}
          </p>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
          <span className="text-[10px] text-muted-foreground font-semibold">
            {statusConfig.label}
          </span>
          {source.lastSync && (
            <span className="text-[9px] text-muted-foreground/70">
              • {new Date(source.lastSync).toLocaleDateString('he-IL')}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {source.promptSuggestion && onPrompt && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPrompt(source.promptSuggestion!)
            }}
            title="שאל את הסוכן על מקור זה"
            className="p-1.5 rounded-lg bg-background/60 hover:bg-background text-muted-foreground hover:text-indigo-600 transition-colors shadow-2xs"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        )}
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="פתח קישור ישיר בטאב חדש"
            className="p-1.5 rounded-lg bg-background/60 hover:bg-background text-muted-foreground hover:text-sky-600 transition-colors shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

// ── SourcesPanel ────────────────────────────────────────────────────────────────

interface SourcesPanelProps {
  sources: NotebookSource[]
  clientId?: string
  clientName?: string
  clients?: Array<{ id: string; name: string }>
  onSourceSelect?: (source: NotebookSource) => void
  onSourcePrompt?: (prompt: string) => void
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function SourcesPanel({
  sources,
  clientId,
  clientName,
  onSourceSelect,
  onSourcePrompt,
  onRefresh,
  isRefreshing,
}: SourcesPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showDocUploader, setShowDocUploader] = useState(false)
  const [showRecordingUploader, setShowRecordingUploader] = useState(false)
  const [selectedSource, setSelectedSource] = useState<NotebookSource | null>(null)
  const router = useRouter()

  const connectedCount = sources.filter((s) => s.status === 'connected' || s.status === 'syncing').length

  const handleSourceClick = (source: NotebookSource) => {
    setSelectedSource(source)
    onSourceSelect?.(source)
  }

  return (
    <div className="h-full flex flex-col bg-card border-l border-border overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 bg-muted/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/10 flex items-center justify-center">
              <Database className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-foreground">מקורות מידע</h3>
                {clientName && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[110px]">
                    {clientName}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {connectedCount}/{sources.length} מחוברים
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onRefresh}
                disabled={isRefreshing}
                title="רענן מקורות"
              >
                {isRefreshing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Sources List */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {sources.map((source) => (
            <SourceItem
              key={source.id}
              source={source}
              onClick={handleSourceClick}
              onPrompt={onSourcePrompt}
            />
          ))}

          {sources.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Database className="w-8 h-8 text-muted-foreground/20 mb-2" />
              <p className="text-xs text-muted-foreground">אין מקורות מחוברים</p>
            </div>
          )}
        </div>
      )}

      {/* Add Source Quick Actions */}
      {!isCollapsed && clientId && (
        <div className="p-3 border-t border-border/60 bg-muted/20 shrink-0 space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDocUploader(true)}
              className="h-7 text-[10px] font-medium gap-1 text-amber-600 border-amber-200/60 hover:bg-amber-500/10 shadow-2xs"
            >
              <FileText className="w-3 h-3" />
              העלה מסמך
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRecordingUploader(true)}
              className="h-7 text-[10px] font-medium gap-1 text-purple-600 border-purple-200/60 hover:bg-purple-500/10 shadow-2xs"
            >
              <Mic2 className="w-3 h-3" />
              הקלטת פגישה
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/workspace/clients/${clientId}`)}
            className="w-full h-7 text-[10px] font-medium gap-1 text-muted-foreground hover:text-foreground"
          >
            <LayoutDashboard className="w-3 h-3" />
            מעבר לדשבורד CRM המלא (v2) ↗
          </Button>
        </div>
      )}

      {/* Source Details Dialog */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-background shadow-xs ${SOURCE_TYPE_CONFIG[selectedSource.type]?.color || 'text-foreground'}`}>
                  {React.createElement(SOURCE_TYPE_CONFIG[selectedSource.type]?.icon || Database, { className: 'w-4 h-4' })}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{selectedSource.label}</h3>
                  <Badge variant="outline" className="text-[9px] py-0 px-1.5 mt-0.5">
                    {SOURCE_TYPE_CONFIG[selectedSource.type]?.label || 'מקור'}
                  </Badge>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setSelectedSource(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                  <span className="text-muted-foreground">סטטוס חיבור:</span>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[selectedSource.status]?.dot}`} />
                    <span>{STATUS_CONFIG[selectedSource.status]?.label}</span>
                  </div>
                </div>

                {selectedSource.lastSync && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-muted-foreground">סנכרון אחרון:</span>
                    <span>{new Date(selectedSource.lastSync).toLocaleString('he-IL')}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {selectedSource.promptSuggestion && onSourcePrompt && (
                  <Button
                    className="w-full text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                    onClick={() => {
                      const prompt = selectedSource.promptSuggestion!
                      setSelectedSource(null)
                      onSourcePrompt(prompt)
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>שאל את הסוכן על מקור זה 💬</span>
                  </Button>
                )}

                {selectedSource.url && (
                  <a
                    href={selectedSource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>פתח קישור ישיר ↗</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {clientId && (
        <>
          <DocumentUploader
            clientId={clientId}
            clientName={clientName}
            isOpen={showDocUploader}
            onClose={() => setShowDocUploader(false)}
          />
          <RecordingUploader
            clientId={clientId}
            clientName={clientName}
            isOpen={showRecordingUploader}
            onClose={() => setShowRecordingUploader(false)}
          />
        </>
      )}
    </div>
  )
}
