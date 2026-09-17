'use client'

/**
 * CitationBadge — Inline citation tag renderer for Notebook chat.
 * Parses and renders [מקור: ...] tags as clickable, styled badges.
 */

import React from 'react'
import {
  TableIcon,
  Mail,
  CalendarDays,
  FileText,
  Mic2,
  FolderOpen,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react'

export interface Citation {
  type: 'sheet' | 'gmail' | 'calendar' | 'document' | 'recording' | 'drive' | 'vault' | 'unknown'
  label: string
  raw: string
}

const CITATION_REGEX = /\[מקור:\s*(.+?)\]/g

const TYPE_PATTERNS: [RegExp, Citation['type']][] = [
  [/גיליון|sheets?|לשונית/i, 'sheet'],
  [/מייל|gmail|דוא.?ל/i, 'gmail'],
  [/יומן|calendar|פגישה/i, 'calendar'],
  [/מסמך|דוח|pdf|word|קובץ/i, 'document'],
  [/הקלטה|תמלול|recording/i, 'recording'],
  [/drive|תיקיי?ה/i, 'drive'],
  [/כספת|vault/i, 'vault'],
]

function classifyCitation(label: string): Citation['type'] {
  for (const [pattern, type] of TYPE_PATTERNS) {
    if (pattern.test(label)) return type
  }
  return 'unknown'
}

export function parseCitations(text: string): Citation[] {
  const citations: Citation[] = []
  let match
  while ((match = CITATION_REGEX.exec(text)) !== null) {
    const label = match[1].trim()
    citations.push({
      type: classifyCitation(label),
      label,
      raw: match[0],
    })
  }
  return citations
}

/**
 * Strips citation tags from text (for clean display when rendering separately).
 */
export function stripCitations(text: string): string {
  return text.replace(CITATION_REGEX, '').trim()
}

const TYPE_CONFIG: Record<Citation['type'], { icon: React.ElementType; color: string; bg: string; border: string }> = {
  sheet:     { icon: TableIcon,   color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800' },
  gmail:     { icon: Mail,        color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-950/40',         border: 'border-red-200 dark:border-red-800' },
  calendar:  { icon: CalendarDays, color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950/40',       border: 'border-blue-200 dark:border-blue-800' },
  document:  { icon: FileText,    color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-950/40',     border: 'border-amber-200 dark:border-amber-800' },
  recording: { icon: Mic2,        color: 'text-purple-600',  bg: 'bg-purple-50 dark:bg-purple-950/40',   border: 'border-purple-200 dark:border-purple-800' },
  drive:     { icon: FolderOpen,  color: 'text-sky-600',     bg: 'bg-sky-50 dark:bg-sky-950/40',         border: 'border-sky-200 dark:border-sky-800' },
  vault:     { icon: ShieldCheck, color: 'text-rose-600',    bg: 'bg-rose-50 dark:bg-rose-950/40',       border: 'border-rose-200 dark:border-rose-800' },
  unknown:   { icon: ExternalLink, color: 'text-slate-500',  bg: 'bg-slate-50 dark:bg-slate-900/40',     border: 'border-slate-200 dark:border-slate-700' },
}

interface CitationBadgeProps {
  citation: Citation
  onClick?: (citation: Citation) => void
}

export function CitationBadge({ citation, onClick }: CitationBadgeProps) {
  const config = TYPE_CONFIG[citation.type]
  const Icon = config.icon

  return (
    <button
      type="button"
      onClick={() => onClick?.(citation)}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all
        ${config.bg} ${config.border} ${config.color}
        hover:opacity-80 hover:shadow-sm cursor-pointer`}
      title={`מקור: ${citation.label}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span className="max-w-[180px] truncate">{citation.label}</span>
    </button>
  )
}

/**
 * Renders text with inline citations replaced by CitationBadge components.
 */
interface CitationTextProps {
  text: string
  onCitationClick?: (citation: Citation) => void
}

export function CitationText({ text, onCitationClick }: CitationTextProps) {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  const regex = /\[מקור:\s*(.+?)\]/g
  while ((match = regex.exec(text)) !== null) {
    // Add text before the citation
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const label = match[1].trim()
    const citation: Citation = {
      type: classifyCitation(label),
      label,
      raw: match[0],
    }

    parts.push(
      <CitationBadge
        key={`cite-${match.index}`}
        citation={citation}
        onClick={onCitationClick}
      />
    )

    lastIndex = regex.lastIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return <>{parts}</>
}
