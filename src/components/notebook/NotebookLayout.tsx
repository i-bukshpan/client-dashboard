'use client'

/**
 * NotebookLayout — Three-column responsive layout for Nehemiah OS v3 Notebook.
 *
 * Columns:
 *   Left:   Sources Panel (מקורות)
 *   Center: Chat (שיחה) — Primary interaction
 *   Right:  Studio (סטודיו)
 *
 * Responsive:
 *   Desktop: All 3 columns visible with collapse toggles
 *   Mobile:  Chat fullscreen with bottom tab bar to switch Sources / Studio
 */

import React, { useState, useCallback } from 'react'
import {
  Database,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import { SourcesPanel } from '@/components/notebook/SourcesPanel'
import { NotebookChat } from '@/components/notebook/NotebookChat'
import { StudioPanel, type StudioArtifact } from '@/components/notebook/StudioPanel'
import type { NotebookSource } from '@/lib/v2/notebook-sources'
import type { Citation } from '@/components/notebook/CitationBadge'

// ── Types ──────────────────────────────────────────────────────────────────────

type MobileView = 'sources' | 'chat' | 'studio'

interface NotebookLayoutProps {
  sources: NotebookSource[]
  artifacts?: StudioArtifact[]
  clientId?: string
  clientName?: string
  clients?: Array<{ id: string; name: string }>
  mode: 'client' | 'global'
}

// ── Component ──────────────────────────────────────────────────────────────────

export function NotebookLayout({
  sources,
  artifacts = [],
  clientId,
  clientName,
  clients = [],
  mode,
}: NotebookLayoutProps) {
  // Desktop: toggle visibility of side panels
  const [showSources, setShowSources] = useState(true)
  const [showStudio, setShowStudio] = useState(true)

  // Mobile: which view is active
  const [mobileView, setMobileView] = useState<MobileView>('chat')

  // Queued prompt from sources click
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null)

  // Handle citation click → highlight source in Sources panel
  const handleCitationClick = useCallback((citation: Citation) => {
    // On mobile, switch to sources view
    setMobileView('sources')
    // On desktop, ensure sources panel is visible
    setShowSources(true)
  }, [])

  // Handle source prompt action → automatically sends to chat
  const handleSourcePrompt = useCallback((prompt: string) => {
    setQueuedPrompt(prompt)
    setMobileView('chat')
  }, [])

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-background bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.07),rgba(255,255,255,0))]">
      {/* ── Desktop Layout (3 columns) ────────────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden min-h-0">
        {/* Left: Sources Panel */}
        {showSources && (
          <div className="w-[260px] xl:w-[280px] shrink-0 overflow-hidden">
            <SourcesPanel
              sources={sources}
              clientId={clientId}
              clientName={mode === 'client' ? clientName : undefined}
              clients={clients}
              onSourcePrompt={handleSourcePrompt}
            />
          </div>
        )}

        {/* Center: Chat (flex-1 = takes all remaining space) */}
        <div className="flex-1 min-w-0 overflow-hidden relative">
          <NotebookChat
            clientId={clientId}
            clientName={clientName}
            clients={clients}
            mode={mode}
            queuedPrompt={queuedPrompt}
            onClearQueuedPrompt={() => setQueuedPrompt(null)}
            onCitationClick={handleCitationClick}
            showSources={showSources}
            onToggleSources={() => setShowSources((v) => !v)}
            showStudio={showStudio}
            onToggleStudio={() => setShowStudio((v) => !v)}
          />
        </div>

        {/* Right: Studio Panel */}
        {showStudio && (
          <div className="w-[260px] xl:w-[280px] shrink-0 overflow-hidden">
            <StudioPanel
              artifacts={artifacts}
              clientId={clientId}
              clientName={mode === 'client' ? clientName : undefined}
            />
          </div>
        )}
      </div>

      {/* ── Mobile Layout (single view + bottom nav) ──────────────────── */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden min-h-0">
        {/* Active view */}
        <div className="flex-1 overflow-hidden min-h-0">
          {mobileView === 'sources' && (
            <SourcesPanel
              sources={sources}
              clientId={clientId}
              clientName={mode === 'client' ? clientName : undefined}
              clients={clients}
              onSourcePrompt={handleSourcePrompt}
            />
          )}
          {mobileView === 'chat' && (
            <NotebookChat
              clientId={clientId}
              clientName={clientName}
              clients={clients}
              mode={mode}
              queuedPrompt={queuedPrompt}
              onClearQueuedPrompt={() => setQueuedPrompt(null)}
              onCitationClick={handleCitationClick}
            />
          )}
          {mobileView === 'studio' && (
            <StudioPanel
              artifacts={artifacts}
              clientId={clientId}
              clientName={mode === 'client' ? clientName : undefined}
            />
          )}
        </div>

        {/* Bottom Navigation Bar */}
        <nav className="h-14 border-t border-border bg-card flex items-center justify-around shrink-0 px-2">
          <button
            type="button"
            onClick={() => setMobileView('sources')}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors ${
              mobileView === 'sources'
                ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                : 'text-muted-foreground'
            }`}
          >
            <Database className="w-5 h-5" />
            <span className="text-[10px] font-medium">מקורות</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileView('chat')}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors ${
              mobileView === 'chat'
                ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                : 'text-muted-foreground'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] font-medium">שיחה</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileView('studio')}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors ${
              mobileView === 'studio'
                ? 'text-violet-600 bg-violet-50 dark:bg-violet-950/40'
                : 'text-muted-foreground'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] font-medium">סטודיו</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
