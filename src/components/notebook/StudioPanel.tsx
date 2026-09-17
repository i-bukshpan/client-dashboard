'use client'

/**
 * StudioPanel — Right column of the Nehemiah OS v3 Notebook layout.
 * Phase 3 Full Implementation:
 * - Saved Artifact repository (Cards, Briefs, Charts, Action Plans, Tables, Meeting Preps)
 * - Detailed preview modal with rich markdown rendering
 * - Pin/Unpin, Copy, Delete, and Time-limited public sharing links
 * - Filter by artifact type & search
 */

import React, { useState, useTransition, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Sparkles,
  FileText,
  BarChart3,
  ClipboardList,
  Table2,
  Briefcase,
  Pin,
  Share2,
  Trash2,
  Copy,
  Check,
  Search,
  ExternalLink,
  X,
  Calendar,
  Maximize2,
  Minimize2,
  Printer,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  deleteStudioArtifactAction,
  togglePinStudioArtifactAction,
  createArtifactShareLinkAction,
  saveStudioArtifactAction,
} from '@/app/workspace/actions/artifacts'
import { ArtifactVisualRenderer } from '@/components/notebook/ArtifactVisualRenderer'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ArtifactType = 'card' | 'brief' | 'chart' | 'action_plan' | 'table' | 'meeting_prep'

export interface StudioArtifact {
  id: string
  type: ArtifactType
  title: string
  preview?: string
  contentMd?: string | null
  contentJson?: Record<string, unknown>
  isPinned?: boolean
  createdAt: string
  shareToken?: string | null
}

// ── Config ─────────────────────────────────────────────────────────────────────

const ARTIFACT_TYPE_CONFIG: Record<ArtifactType, { icon: React.ElementType; color: string; label: string; bg: string }> = {
  card:         { icon: BarChart3,      color: 'text-violet-500', bg: 'bg-violet-500/10', label: 'כרטיס KPI' },
  brief:        { icon: FileText,       color: 'text-indigo-500', bg: 'bg-indigo-500/10', label: 'בריף' },
  chart:        { icon: BarChart3,      color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'גרף' },
  action_plan:  { icon: ClipboardList,  color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'תוכנית פעולה' },
  table:        { icon: Table2,         color: 'text-sky-500', bg: 'bg-sky-500/10', label: 'טבלה' },
  meeting_prep: { icon: Briefcase,      color: 'text-rose-500', bg: 'bg-rose-500/10', label: 'תקציר פגישה' },
}

interface StudioPanelProps {
  artifacts?: StudioArtifact[]
  clientId?: string
  clientName?: string
}

export function StudioPanel({
  artifacts: initialArtifacts = [],
  clientId,
  clientName,
}: StudioPanelProps) {
  const [artifacts, setArtifacts] = useState<StudioArtifact[]>(initialArtifacts)
  const [activeType, setActiveType] = useState<ArtifactType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArtifact, setSelectedArtifact] = useState<StudioArtifact | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [mounted, setMounted] = useState(false)

  // Ensure mounted on client for Portal rendering
  useEffect(() => {
    setMounted(true)
  }, [])

  // Listen for Escape key to close modal
  useEffect(() => {
    if (!selectedArtifact) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedArtifact(null)
        setIsFullscreen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedArtifact])

  // Update local list if initialArtifacts changes from parent, merged with local storage
  useEffect(() => {
    const localKey = `nehemiah_v3_local_artifacts_${clientId || 'global'}`
    let localItems: StudioArtifact[] = []
    try {
      const stored = localStorage.getItem(localKey)
      if (stored) {
        const raw = JSON.parse(stored)
        let changed = false
        // Migrate legacy IDs to RFC4122 UUIDs and clean up corrupted characters
        localItems = raw.map((item: any) => {
          const updated = { ...item }
          if (!item.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)) {
            updated.id = typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>
                  (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
                )
            changed = true
          }
          if (item.title && /[\uD800-\uDFFF\uFFFD]/.test(item.title)) {
            updated.title = item.title.replace(/[\uD800-\uDFFF\uFFFD]/g, '').trim() || 'ארטיפקט שמור'
            changed = true
          }
          return updated
        })
        if (changed) {
          localStorage.setItem(localKey, JSON.stringify(localItems))
        }
      }
    } catch {}

    const combined = [...localItems]
    const seen = new Set(localItems.map((a) => a.id))
    for (const item of initialArtifacts) {
      if (!seen.has(item.id)) {
        combined.push(item)
        seen.add(item.id)
      }
    }
    setArtifacts(combined)

    // Listen to live save events from NotebookChat
    const handleArtifactSaved = (event: Event) => {
      const customEv = event as CustomEvent<StudioArtifact>
      const newArt = customEv.detail
      if (newArt) {
        setArtifacts((prev) => {
          if (prev.some((a) => a.id === newArt.id)) return prev
          return [newArt, ...prev]
        })
      }
    }

    // Listen for direct open modal request from anywhere (Chat / Tables / Cards)
    const handleOpenArtifactModal = (event: Event) => {
      const customEv = event as CustomEvent<StudioArtifact>
      if (customEv.detail) {
        setSelectedArtifact(customEv.detail)
      }
    }

    window.addEventListener('nehemiah_artifact_saved', handleArtifactSaved)
    window.addEventListener('nehemiah_open_artifact_modal', handleOpenArtifactModal)
    return () => {
      window.removeEventListener('nehemiah_artifact_saved', handleArtifactSaved)
      window.removeEventListener('nehemiah_open_artifact_modal', handleOpenArtifactModal)
    }
  }, [initialArtifacts, clientId])

  // Filter & Search
  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((a) => {
      const matchesType = activeType === 'all' || a.type === activeType
      const matchesQuery = !searchQuery.trim() ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.preview && a.preview.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchesType && matchesQuery
    })
  }, [artifacts, activeType, searchQuery])

  // Actions
  const handleTogglePin = (artifact: StudioArtifact) => {
    startTransition(async () => {
      const nextPinned = !artifact.isPinned
      // Optimistic update
      setArtifacts((prev) =>
        prev.map((a) => (a.id === artifact.id ? { ...a, isPinned: nextPinned } : a))
      )
      if (selectedArtifact?.id === artifact.id) {
        setSelectedArtifact((prev) => (prev ? { ...prev, isPinned: nextPinned } : null))
      }

      // Sync local storage immediately
      const localKey = `nehemiah_v3_local_artifacts_${clientId || 'global'}`
      try {
        const stored = localStorage.getItem(localKey)
        if (stored) {
          const parsed = JSON.parse(stored).map((a: any) =>
            a.id === artifact.id ? { ...a, isPinned: nextPinned } : a
          )
          localStorage.setItem(localKey, JSON.stringify(parsed))
        }
      } catch {}

      try {
        const res = await togglePinStudioArtifactAction(artifact.id, clientId)
        if (res.success) {
          toast.success(res.isPinned ? 'הארטיפקט ננעץ בראש הרשימה 📌' : 'הנעיצה הוסרה')
        } else if (res.error?.includes('ארטיפקט לא נמצא')) {
          // If not in DB yet, auto-save to DB with pin state
          await saveStudioArtifactAction({
            id: artifact.id,
            clientId: clientId || null,
            artifactType: artifact.type,
            title: artifact.title,
            contentMd: artifact.contentMd,
            isPinned: nextPinned,
          })
          toast.success(nextPinned ? 'הארטיפקט ננעץ ונשמר בשרת 📌' : 'הנעיצה הוסרה')
        } else {
          toast.info(nextPinned ? 'הארטיפקט ננעץ מקומית' : 'הנעיצה הוסרה')
        }
      } catch {
        toast.info(nextPinned ? 'הארטיפקט ננעץ מקומית' : 'הנעיצה הוסרה')
      }
    })
  }

  const handleDelete = (artifactId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק ארטיפקט זה?')) return
    startTransition(async () => {
      const res = await deleteStudioArtifactAction(artifactId, clientId)
      if (res.success || !res.error) {
        setArtifacts((prev) => prev.filter((a) => a.id !== artifactId))
        if (selectedArtifact?.id === artifactId) {
          setSelectedArtifact(null)
        }
        const localKey = `nehemiah_v3_local_artifacts_${clientId || 'global'}`
        try {
          const stored = localStorage.getItem(localKey)
          if (stored) {
            const parsed = JSON.parse(stored).filter((p: any) => p.id !== artifactId)
            localStorage.setItem(localKey, JSON.stringify(parsed))
          }
        } catch {}
        toast.success('הארטיפקט נמחק בהצלחה')
      } else {
        // Fallback: if server returned error because table isn't migrated, still remove from local storage
        setArtifacts((prev) => prev.filter((a) => a.id !== artifactId))
        const localKey = `nehemiah_v3_local_artifacts_${clientId || 'global'}`
        try {
          const stored = localStorage.getItem(localKey)
          if (stored) {
            const parsed = JSON.parse(stored).filter((p: any) => p.id !== artifactId)
            localStorage.setItem(localKey, JSON.stringify(parsed))
          }
        } catch {}
        toast.info('הארטיפקט הוסר מהתצוגה')
      }
    })
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success('הועתק ללוח!')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleShare = (artifact: StudioArtifact) => {
    startTransition(async () => {
      try {
        let res = await createArtifactShareLinkAction(artifact.id)
        if (!res.success && res.error?.includes('ארטיפקט לא נמצא')) {
          // Auto-save to Supabase if not yet present in DB
          await saveStudioArtifactAction({
            id: artifact.id,
            clientId: clientId || null,
            artifactType: artifact.type,
            title: artifact.title,
            contentMd: artifact.contentMd,
            isPinned: artifact.isPinned,
          })
          res = await createArtifactShareLinkAction(artifact.id)
        }

        if (res.success && res.shareUrl) {
          const fullUrl = `${window.location.origin}${res.shareUrl}`
          navigator.clipboard.writeText(fullUrl)
          toast.success('קישור שיתוף מאובטח הועתק ללוח! 🔗')
        } else {
          toast.error(`שגיאה בהפקת קישור שיתוף: ${res.error || 'נסה שוב'}`)
        }
      } catch (err: any) {
        toast.error(`שגיאה בהפקת קישור שיתוף: ${err.message || 'שגיאה'}`)
      }
    })
  }

  return (
    <div className="h-full flex flex-col bg-card border-r border-border overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 bg-muted/30 shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-600/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-violet-500" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground">סטודיו תוצרים</h3>
              <p className="text-[10px] text-muted-foreground">
                {artifacts.length} ארטיפקטים {clientName ? `עבור ${clientName}` : 'שמורים'}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3 h-3 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש בארטיפקטים..."
            className="h-7 pr-7 pl-2 text-xs bg-background/50 border-border/60"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[10px]">
          <button
            type="button"
            onClick={() => setActiveType('all')}
            className={`px-2 py-0.5 rounded-full font-medium transition-all shrink-0 ${
              activeType === 'all'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            הכל ({artifacts.length})
          </button>
          {(Object.keys(ARTIFACT_TYPE_CONFIG) as ArtifactType[]).map((type) => {
            const count = artifacts.filter((a) => a.type === type).length
            if (count === 0 && activeType !== type) return null
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(type)}
                className={`px-2 py-0.5 rounded-full font-medium transition-all shrink-0 ${
                  activeType === type
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                {ARTIFACT_TYPE_CONFIG[type].label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Artifacts List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {filteredArtifacts.length > 0 ? (
          filteredArtifacts.map((artifact) => {
            const config = ARTIFACT_TYPE_CONFIG[artifact.type] || ARTIFACT_TYPE_CONFIG.card
            const Icon = config.icon
            return (
              <div
                key={artifact.id}
                onClick={() => setSelectedArtifact(artifact)}
                className={`p-3 rounded-xl border transition-all cursor-pointer group relative space-y-1.5 ${
                  selectedArtifact?.id === artifact.id
                    ? 'bg-violet-500/10 border-violet-500/40 shadow-xs'
                    : 'bg-muted/30 border-border/40 hover:border-border hover:bg-muted/50'
                }`}
              >
                {/* Top Row: Icon + Title + Actions */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-background shadow-2xs ${config.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-xs font-bold text-foreground truncate leading-snug">
                      {artifact.title}
                    </p>
                    {artifact.isPinned && (
                      <Pin className="w-3 h-3 text-amber-500 shrink-0 fill-amber-500/40" />
                    )}
                  </div>

                  {/* Actions toolbar */}
                  <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTogglePin(artifact)
                      }}
                      title={artifact.isPinned ? 'בטל נעיצה' : 'נעץ בראש'}
                      className={`p-1 rounded-md hover:bg-background/80 transition-colors cursor-pointer ${
                        artifact.isPinned ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'
                      }`}
                    >
                      <Pin className={`w-3.5 h-3.5 ${artifact.isPinned ? 'fill-amber-500' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleShare(artifact)
                      }}
                      title="העתק קישור שיתוף"
                      className="p-1 rounded-md hover:bg-background/80 text-muted-foreground hover:text-sky-500 transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedArtifact(artifact)}
                      title="פתח בחלון מורחב"
                      className="p-1 rounded-md hover:bg-background/80 text-violet-600 dark:text-violet-400 transition-colors cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Second Row: Badges and Date */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                  <Badge variant="outline" className={`text-[9px] py-0 px-1.5 font-medium ${config.bg} ${config.color} border-transparent`}>
                    {config.label}
                  </Badge>
                  <span>
                    {new Date(artifact.createdAt).toLocaleDateString('he-IL')}
                  </span>
                </div>

                {/* Preview text */}
                {artifact.preview && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed pt-0.5 border-t border-border/20">
                    {artifact.preview}
                  </p>
                )}
              </div>
            )
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-600/10 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-violet-500/50" />
            </div>
            <p className="text-xs font-bold text-foreground mb-1">
              {searchQuery || activeType !== 'all' ? 'לא נמצאו תוצרים תואמים' : 'הסטודיו ריק כרגע'}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[200px]">
              בקש מהסוכן: &quot;שמור את זה בסטודיו&quot; או לחץ על כפתור השמירה בתשובות ה-AI.
            </p>
          </div>
        )}
      </div>

      {/* Artifact Preview Modal — Rendered via React Portal to document.body for true full-viewport overlay */}
      {mounted &&
        selectedArtifact &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 lg:p-8 animate-in fade-in duration-150"
            dir="rtl"
            onClick={() => {
              setSelectedArtifact(null)
              setIsFullscreen(false)
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`bg-card border border-border shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
                isFullscreen
                  ? 'fixed inset-0 z-[100000] w-screen h-screen rounded-none border-0'
                  : 'w-[96vw] max-w-6xl xl:max-w-7xl 2xl:max-w-[1500px] h-[90vh] max-h-[94vh] rounded-2xl'
              }`}
            >
              {/* Modal Header */}
              <div className="px-5 sm:px-7 py-3.5 sm:py-4 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-background shadow-xs shrink-0 ${ARTIFACT_TYPE_CONFIG[selectedArtifact.type]?.color || 'text-violet-500'}`}>
                    {React.createElement(ARTIFACT_TYPE_CONFIG[selectedArtifact.type]?.icon || FileText, { className: 'w-5 h-5' })}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-foreground truncate">
                        {selectedArtifact.title}
                      </h2>
                      {clientName && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-2 font-bold shrink-0 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                          {clientName}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className={`text-[10px] py-0 px-2 font-bold ${ARTIFACT_TYPE_CONFIG[selectedArtifact.type]?.bg || ''} ${ARTIFACT_TYPE_CONFIG[selectedArtifact.type]?.color || ''} border-transparent`}>
                        {ARTIFACT_TYPE_CONFIG[selectedArtifact.type]?.label || 'ארטיפקט'}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(selectedArtifact.createdAt).toLocaleString('he-IL')}
                      </span>
                      <span className="hidden sm:inline-block text-[10px] text-muted-foreground/70">
                        • {isFullscreen ? 'מסך מלא ⛶' : 'חלון מורחב ↔'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 cursor-pointer"
                    onClick={() => handleTogglePin(selectedArtifact)}
                    disabled={isPending}
                  >
                    <Pin className={`w-3.5 h-3.5 ${selectedArtifact.isPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
                    <span className="hidden sm:inline">{selectedArtifact.isPinned ? 'הסר נעיצה' : 'נעץ'}</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 text-sky-600 dark:text-sky-400 cursor-pointer"
                    onClick={() => handleShare(selectedArtifact)}
                    disabled={isPending}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">שיתוף בקישור</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => window.print()}
                    title="הדפס תוצר זה"
                  >
                    <Printer className="w-4 h-4" />
                  </Button>

                  <Button
                    size="sm"
                    variant={isFullscreen ? 'secondary' : 'ghost'}
                    className={`h-8 px-2.5 text-xs gap-1.5 cursor-pointer ${
                      isFullscreen ? 'font-bold text-indigo-600' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setIsFullscreen((prev) => !prev)}
                    title={isFullscreen ? 'צא ממסך מלא' : 'הגדל למסך מלא'}
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize2 className="w-4 h-4" />
                        <span className="hidden md:inline">צא ממסך מלא</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-4 h-4" />
                        <span className="hidden md:inline">מסך מלא</span>
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => {
                      setSelectedArtifact(null)
                      setIsFullscreen(false)
                    }}
                    title="סגור חלון"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Modal Body — Rich Visuals */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-card/60">
                <div className="w-full">
                  <ArtifactVisualRenderer
                    content={selectedArtifact.contentMd || selectedArtifact.preview || ''}
                    showSaveButtons={false}
                  />
                </div>

                {selectedArtifact.contentJson && Object.keys(selectedArtifact.contentJson).length > 0 && (
                  <details className="rounded-xl border border-border/60 bg-muted/30 p-3.5 text-xs group">
                    <summary className="font-bold text-muted-foreground cursor-pointer flex items-center justify-between">
                      <span>נתונים מובנים נוספים (JSON)</span>
                      <span className="text-[10px] text-indigo-500 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <pre className="mt-2 font-mono text-[11px] overflow-x-auto text-foreground/80 p-2.5 bg-muted/60 rounded-lg">
                      {JSON.stringify(selectedArtifact.contentJson, null, 2)}
                    </pre>
                  </details>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-border bg-muted/30 flex items-center justify-between shrink-0">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => handleDelete(selectedArtifact.id)}
                  disabled={isPending}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>מחק ארטיפקט</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => handleCopy(selectedArtifact.contentMd || selectedArtifact.preview || '', selectedArtifact.id)}
                  >
                    {copiedId === selectedArtifact.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>הועתק ללוח!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>העתק תוכן מלא</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
