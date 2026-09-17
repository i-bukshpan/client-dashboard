'use client'

/**
 * ArtifactVisualRenderer — High-Fidelity Visual Component Renderer.
 *
 * Transforms raw markdown artifacts and AI responses into luxury enterprise UI:
 * - Real styled HTML tables with tabular figures, zebra striping, currency highlights, and Hebrew RTL alignment
 * - High-end KPI / Info Cards with glassmorphic gradients, icons, and metric chips
 * - Stat Metric Grids: Detects key-value bullet metrics and transforms them into multi-column KPI stat tiles
 * - Visual progress bars and percentage meters (e.g. [████████░░] 80%)
 * - Checklists and Action Plans (- [ ] / - [x]) with interactive-styled checkboxes
 * - Headings (H1, H2, H3) with luxurious typography, gradient accents, and section badges
 * - Rich inline formatting: **bold**, *italic*, `code`, currency (₪/$) and percentages
 * - Clickable citation badges ([מקור: ...])
 * - Instant "שמור לסטודיו 📌" button on each table, card, or plan
 */

import React, { useMemo, useState } from 'react'
import {
  Table2,
  BarChart3,
  CheckSquare,
  Square,
  BookmarkPlus,
  CheckCircle2,
  Layers,
  Sparkles,
  DollarSign,
  TrendingUp,
  Calendar,
  AlertCircle,
  FileText,
  Copy,
  Check,
  Zap,
  Target,
  Clock,
  ArrowUpRight,
  Maximize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CitationBadge, parseCitations, type Citation } from '@/components/notebook/CitationBadge'
import type { ArtifactType } from '@/components/notebook/StudioPanel'
import { toast } from 'sonner'

export interface ChartBarItem {
  label: string
  value: string
  percentage: number
  color: 'emerald' | 'rose' | 'amber' | 'indigo' | 'sky' | 'violet'
  note?: string
}

interface ArtifactVisualRendererProps {
  content: string
  onCitationClick?: (citation: Citation) => void
  onPromptClick?: (prompt: string) => void
  onSaveArtifact?: (title: string, type: ArtifactType, contentMd: string) => void
  showSaveButtons?: boolean
}

type BlockType =
  | 'table'
  | 'chart'
  | 'card'
  | 'stat_grid'
  | 'checklist'
  | 'heading'
  | 'list'
  | 'blockquote'
  | 'code_block'
  | 'paragraph'

interface StatMetric {
  label: string
  value: string
  note?: string
}

interface ParsedBlock {
  type: BlockType
  content: string
  title?: string
  headingLevel?: number
  headers?: string[]
  rows?: string[][]
  items?: { text: string; checked?: boolean; number?: number }[]
  metrics?: StatMetric[]
  chartItems?: ChartBarItem[]
  language?: string
}

// ── Status Badge Detector ──────────────────────────────────────────────────────

export function renderStatusBadge(text: string): React.ReactNode | null {
  if (!text) return null
  const trimmed = text.trim().replace(/^[`*]+|[`*]+$/g, '')

  // Emerald / Positive Status
  if (/^(תקין|הושלם|אושר|שולם|פעיל|רווחיות טובה|מצוין|הצלחה|מאושר|בוצע)$/i.test(trimmed)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.25)] whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {trimmed}
      </span>
    )
  }

  // Amber / Warning / In-Progress Status
  if (/^(דורש גבייה|בטיפול|ממתין|מעקב|חלקי|התראה|ממתין לאישור|בתהליך|בעבודה|דחוי)$/i.test(trimmed)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)] whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {trimmed}
      </span>
    )
  }

  // Rose / Critical / Deficit Status
  if (/^(קריטי|חריגה|דחוף|פיגור|בוטל|נכשל|חוב אבוד|גירעון|סיכון גבוה|הפסד)$/i.test(trimmed)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.25)] whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        {trimmed}
      </span>
    )
  }

  return null
}

// ── Rich Inline Text Parser ───────────────────────────────────────────────────

/**
 * Parses markdown inline syntax into styled React elements:
 * - [מקור: ...] -> CitationBadge
 * - [הצעה: ...] / [שאלה: ...] -> Clickable interactive prompt chip
 * - [████░░] 80% -> Animated progress bar
 * - `code` -> inline code badge
 * - **bold** -> <strong>
 * - *italic* -> <em>
 * - ₪12,345 or 12,345 ₪ -> highlighted currency
 * - 85% -> highlighted percentage
 */
export function renderRichInline(
  text: string,
  onCitationClick?: (citation: Citation) => void,
  onPromptClick?: (prompt: string) => void
): React.ReactNode {
  if (!text) return null

  // Tokenize the string using regex capturing
  // 1: Citation [מקור: ...]
  // 2: Suggestion / Interactive prompt [הצעה: ...] or [שאלה: ...]
  // 3: Progress [████░░] 80%
  // 4: Inline code `...`
  // 5: Bold **...**
  // 6: Currency ₪12,345 or 12,345 ₪ or $100 (requires at least one digit)
  // 7: Italic *...*
  const tokenRegex =
    /(\[מקור:\s*[^\]]+\])|(\[(?:הצעה|שאלה|פעולה):\s*[^\]]+\])|(\[(?:[█=]+)(?:[░\s\-_]*?)\]\s*\d{1,3}%)|(`[^`]+`)|(\*\*[^*]+\*\*)|((?:₪\s*\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s*₪|\$\s*\d[\d,]*(?:\.\d+)?))|(\*[^*]+\*)/g

  const elements: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index))
    }

    const fullMatch = match[0]

    // 1. Citation
    if (match[1]) {
      const citations = parseCitations(fullMatch)
      if (citations.length > 0) {
        elements.push(
          <CitationBadge
            key={`cit-${match.index}`}
            citation={citations[0]}
            onClick={onCitationClick}
          />
        )
      } else {
        elements.push(fullMatch)
      }
    }
    // 2. Interactive Suggestion / Prompt Chip
    else if (match[2]) {
      const colonIdx = fullMatch.indexOf(':')
      const promptText = (colonIdx !== -1 ? fullMatch.slice(colonIdx + 1, -1) : fullMatch.slice(7, -1)).trim()
      elements.push(
        <button
          key={`sug-${match.index}`}
          type="button"
          onClick={() => onPromptClick?.(promptText)}
          className="inline-flex items-center gap-1.5 px-3 py-1 my-1 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-indigo-500/15 border border-indigo-500/35 hover:border-indigo-500 hover:bg-indigo-500/25 text-indigo-800 dark:text-indigo-200 hover:shadow-sm transition-all cursor-pointer group"
          title="לחץ להעמקת השיחה בנושא זה"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 group-hover:rotate-12 transition-transform" />
          <span>{promptText}</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-indigo-500/80 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      )
    }
    // 3. Progress Bar
    else if (match[3]) {
      const pMatch = fullMatch.match(/\[([█=]+)([░\s\-_]*)\]\s*(\d{1,3}%)/)
      const percentStr = pMatch ? pMatch[3] : '0%'
      const percentNum = parseInt(percentStr.replace('%', ''), 10) || 0

      elements.push(
        <span
          key={`prog-${match.index}`}
          className="inline-flex items-center gap-2 px-2.5 py-0.5 my-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 align-middle"
        >
          <span className="w-20 h-2 rounded-full bg-muted/80 overflow-hidden inline-flex">
            <span
              className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500 rounded-full transition-all"
              style={{ width: `${Math.min(Math.max(percentNum, 0), 100)}%` }}
            />
          </span>
          <span className="tabular-nums">{percentStr}</span>
        </span>
      )
    }
    // 4. Inline Code
    else if (match[4]) {
      const codeContent = fullMatch.slice(1, -1)
      elements.push(
        <code
          key={`code-${match.index}`}
          className="px-1.5 py-0.5 rounded-md bg-muted font-mono text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 border border-border/60"
        >
          {codeContent}
        </code>
      )
    }
    // 5. Bold
    else if (match[5]) {
      const boldContent = fullMatch.slice(2, -2)
      elements.push(
        <strong
          key={`bold-${match.index}`}
          className="font-black text-foreground"
        >
          {renderRichInline(boldContent, onCitationClick, onPromptClick)}
        </strong>
      )
    }
    // 6. Currency
    else if (match[6]) {
      elements.push(
        <span
          key={`curr-${match.index}`}
          className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20"
        >
          {fullMatch}
        </span>
      )
    }
    // 7. Italic
    else if (match[7]) {
      const italicContent = fullMatch.slice(1, -1)
      elements.push(
        <em key={`em-${match.index}`} className="italic text-foreground/90">
          {italicContent}
        </em>
      )
    }

    lastIndex = tokenRegex.lastIndex
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex))
  }

  return elements.length > 0 ? elements : text
}

// ── Markdown Document Block Parser ─────────────────────────────────────────────

function parseDocumentBlocks(rawText: string): ParsedBlock[] {
  const lines = rawText.split('\n')
  const blocks: ParsedBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Skip empty lines
    if (!trimmed) {
      i++
      continue
    }

    // ── 1. Chart Block (```chart or ```chart:bar) ───────────────────────────
    if (trimmed.startsWith('```chart')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++ // consume closing ```
      }

      const chartItems: ChartBarItem[] = []
      let chartTitle = 'תרשים השוואתי ומדדי ביצוע'

      for (const cLine of codeLines) {
        const raw = cLine.trim()
        if (!raw) continue
        if (raw.startsWith('#') || raw.toLowerCase().startsWith('title:')) {
          chartTitle = raw.replace(/^#+\s*|^title:\s*/i, '').trim()
          continue
        }

        const parts = raw.split('|').map((p) => p.trim())
        const firstPart = parts[0]
        let label = firstPart
        let value = ''

        if (firstPart.includes(':')) {
          const splitColon = firstPart.split(':')
          label = splitColon[0].trim()
          value = splitColon.slice(1).join(':').trim()
        } else if (parts.length > 1 && !parts[1].endsWith('%')) {
          value = parts[1]
        }

        let percentage = 0
        const percentPart = parts.find((p) => p.endsWith('%'))
        if (percentPart) {
          percentage = parseFloat(percentPart.replace('%', '')) || 0
        }

        let color: 'emerald' | 'rose' | 'amber' | 'indigo' | 'sky' | 'violet' = 'indigo'
        const colorPart = parts.find((p) =>
          ['emerald', 'rose', 'amber', 'indigo', 'sky', 'violet'].includes(p.toLowerCase())
        )
        if (colorPart) {
          color = colorPart.toLowerCase() as any
        } else {
          if (/הכנס|רווח|תקבול|גבייה מוצלחת|חיובי|נכסים/i.test(label)) color = 'emerald'
          else if (/הוצא|שכר|מס|עלות|הפסד|חוב/i.test(label)) color = 'rose'
          else if (/שכירות|תפעול|ספק|ממתין|גבייה פתוחה/i.test(label)) color = 'amber'
          else if (/מזומן|בנק|יתרה|תזרים/i.test(label)) color = 'sky'
          else if (/יעד|תקציב|צפי/i.test(label)) color = 'violet'
        }

        chartItems.push({
          label,
          value: value || label,
          percentage: Math.min(Math.max(percentage, 0), 100),
          color,
        })
      }

      // If percentage is 0 for all items, auto-calculate relative percentage from numeric values
      const hasZeroPercent = chartItems.every((item) => item.percentage === 0)
      if (hasZeroPercent && chartItems.length > 0) {
        const numericValues = chartItems.map((item) => {
          const cleanNum = item.value.replace(/[^\d.]/g, '')
          return parseFloat(cleanNum) || 0
        })
        const maxVal = Math.max(...numericValues, 1)
        chartItems.forEach((item, idx) => {
          item.percentage = Math.round((numericValues[idx] / maxVal) * 100)
        })
      }

      blocks.push({
        type: 'chart',
        title: chartTitle,
        content: codeLines.join('\n'),
        chartItems,
      })
      continue
    }

    // ── 1b. Regular Code Block (```) ──────────────────────────────────────────
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim() || 'text'
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++ // consume closing ```
      }
      blocks.push({
        type: 'code_block',
        content: codeLines.join('\n'),
        language: lang,
      })
      continue
    }

    // ── 2. Markdown Table ────────────────────────────────────────────────────
    if (
      trimmed.startsWith('|') &&
      trimmed.endsWith('|') &&
      i + 1 < lines.length &&
      lines[i + 1].includes('---')
    ) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }

      if (tableLines.length >= 2) {
        const headerCols = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim())
        const rowLines = tableLines.slice(2)
        const rowCols = rowLines.map((r) =>
          r
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim())
        )

        blocks.push({
          type: 'table',
          content: tableLines.join('\n'),
          title: headerCols.join(' · ') || 'טבלת נתונים מסודרת',
          headers: headerCols,
          rows: rowCols,
        })
      }
      continue
    }

    // ── 3. Checklists / Action Plan (- [ ] or - [x]) ─────────────────────────
    if (trimmed.match(/^[-*]\s+\[([ xX])\]\s+/)) {
      const items: { text: string; checked: boolean }[] = []
      const taskLines: string[] = []

      while (i < lines.length && lines[i].trim().match(/^[-*]\s+\[([ xX])\]\s+(.*)/)) {
        const m = lines[i].trim().match(/^[-*]\s+\[([ xX])\]\s+(.*)/)
        if (m) {
          items.push({
            checked: m[1].toLowerCase() === 'x',
            text: m[2],
          })
          taskLines.push(lines[i])
        }
        i++
      }

      blocks.push({
        type: 'checklist',
        title: 'תוכנית פעולה ומשימות',
        content: taskLines.join('\n'),
        items,
      })
      continue
    }

    // ── 4. Stat Metric Grid (2+ bullet points with **Key:** Value) ───────────
    const statBulletRegex = /^[-*•]\s+\*\*([^*:]+):\*\*\s*(.+)$/
    if (statBulletRegex.test(trimmed)) {
      // Look ahead to see if there are 2 or more consecutive metric bullets
      let j = i
      const collectedMetrics: StatMetric[] = []
      const metricLines: string[] = []

      while (j < lines.length) {
        const m = lines[j].trim().match(statBulletRegex)
        if (!m) break
        collectedMetrics.push({
          label: m[1].trim(),
          value: m[2].trim(),
        })
        metricLines.push(lines[j])
        j++
      }

      // ONLY convert to stat_grid if ALL items are concise single-value KPI metrics:
      // - Short value (<= 45 chars without citations)
      // - No multi-item breakdowns with multiple parenthetical tags like (משרד) ... (מפעל)
      // - Not a long sentence with explanatory periods
      const areAllConciseKpi =
        collectedMetrics.length >= 2 &&
        collectedMetrics.every((metric) => {
          const rawVal = metric.value.replace(/\[מקור:[^\]]+\]/g, '').trim()
          const hasMultipleCommas = (rawVal.match(/,/g) || []).length > 1
          const hasMultipleParens = (rawVal.match(/\([^)]+\)/g) || []).length > 1
          const isTooLong = rawVal.length > 45
          const hasSentencePeriod = rawVal.includes('. ')

          return !isTooLong && !hasMultipleCommas && !hasMultipleParens && !hasSentencePeriod
        })

      if (areAllConciseKpi) {
        blocks.push({
          type: 'stat_grid',
          content: metricLines.join('\n'),
          metrics: collectedMetrics,
        })
        i = j
        continue
      }
    }

    // ── 5. KPI / Info Card Header (### 📊 ... or ### 💳 ... or ### כרטיס...) ─
    const cardMatch = trimmed.match(
      /^###?\s+([📊💳📈📋🎯💡📌⚡💰📅🏢].*|כרטיס.*|מדדי.*|סטטוס.*|סיכום.*|תקציר.*|דוח.*|יעד.*)/i
    )
    if (cardMatch) {
      const cardTitle = cardMatch[1].trim()
      const cardLines: string[] = [line]
      i++

      while (
        i < lines.length &&
        !lines[i].trim().startsWith('#') &&
        !lines[i].trim().startsWith('|') &&
        !lines[i].trim().match(/^[-*]\s+\[([ xX])\]/)
      ) {
        // stop if double empty line
        if (
          lines[i].trim() === '' &&
          i + 1 < lines.length &&
          lines[i + 1].trim() === ''
        ) {
          break
        }
        cardLines.push(lines[i])
        i++
      }

      blocks.push({
        type: 'card',
        title: cardTitle,
        content: cardLines.join('\n'),
      })
      continue
    }

    // ── 6. Markdown Headings (#, ##, ###, ####) ──────────────────────────────
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        headingLevel: headingMatch[1].length,
        title: headingMatch[2].trim(),
        content: line,
      })
      i++
      continue
    }

    // ── 7. Blockquote (> ...) ────────────────────────────────────────────────
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''))
        i++
      }
      blocks.push({
        type: 'blockquote',
        content: quoteLines.join('\n'),
      })
      continue
    }

    // ── 8. Regular Lists (- / * / 1. 2.) ─────────────────────────────────────
    const isUnordered = /^[-*•]\s+(.+)/.test(trimmed)
    const isOrdered = /^(\d+)\.\s+(.+)/.test(trimmed)
    if (isUnordered || isOrdered) {
      const listItems: { text: string; number?: number }[] = []
      const listLines: string[] = []

      while (i < lines.length) {
        const t = lines[i].trim()
        const unMatch = t.match(/^[-*•]\s+(.+)/)
        const ordMatch = t.match(/^(\d+)\.\s+(.+)/)

        if (unMatch) {
          listItems.push({ text: unMatch[1] })
          listLines.push(lines[i])
          i++
        } else if (ordMatch) {
          listItems.push({ text: ordMatch[2], number: parseInt(ordMatch[1], 10) })
          listLines.push(lines[i])
          i++
        } else {
          break
        }
      }

      blocks.push({
        type: 'list',
        content: listLines.join('\n'),
        items: listItems,
      })
      continue
    }

    // ── 9. Normal Paragraph ──────────────────────────────────────────────────
    const paragraphLines: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('|') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().match(/^[-*•]\s+/) &&
      !lines[i].trim().match(/^\d+\.\s+/)
    ) {
      paragraphLines.push(lines[i])
      i++
    }

    blocks.push({
      type: 'paragraph',
      content: paragraphLines.join('\n'),
    })
  }

  return blocks
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ArtifactVisualRenderer({
  content,
  onCitationClick,
  onPromptClick,
  onSaveArtifact,
  showSaveButtons = false,
}: ArtifactVisualRendererProps) {
  const blocks = useMemo(() => parseDocumentBlocks(content || ''), [content])
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null)

  const handleCopyCode = (codeText: string, idx: number) => {
    navigator.clipboard.writeText(codeText)
    setCopiedCodeIdx(idx)
    toast.success('הקוד הועתק ללוח!')
    setTimeout(() => setCopiedCodeIdx(null), 2000)
  }

  return (
    <div className="space-y-4 text-right leading-relaxed font-sans" dir="rtl">
      {blocks.map((block, idx) => {
        // ── 1. Table ─────────────────────────────────────────────────────────
        if (block.type === 'table' && block.headers && block.rows) {
          return (
            <div
              key={idx}
              className="my-3.5 rounded-2xl border border-sky-400/30 dark:border-sky-800/60 bg-gradient-to-b from-sky-500/[0.04] to-sky-500/[0.01] dark:from-sky-950/25 dark:to-transparent backdrop-blur-sm shadow-sm overflow-hidden"
            >
              {/* Table Top Bar */}
              <div className="px-4 py-2.5 bg-sky-500/10 dark:bg-sky-900/30 border-b border-sky-200/70 dark:border-sky-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-900 dark:text-sky-300">
                  <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center shadow-2xs">
                    <Table2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <span className="font-extrabold text-sm">{block.title}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 px-2 border-sky-300 dark:border-sky-700 bg-sky-500/15 text-sky-800 dark:text-sky-300 font-bold"
                  >
                    {block.rows.length} שורות
                  </Badge>
                </div>

                <div className="flex items-center gap-1">
                  {showSaveButtons && onSaveArtifact && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onSaveArtifact(block.title || 'טבלת נתונים', 'table', block.content)
                      }
                      className="h-6 px-2 text-[10px] font-bold gap-1 text-sky-800 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer"
                      title="שמור טבלה זו לסטודיו"
                    >
                      <BookmarkPlus className="w-3 h-3" />
                      <span>שמור טבלה 📌</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('nehemiah_open_artifact_modal', {
                          detail: {
                            id: `preview_${Date.now()}`,
                            type: 'table',
                            title: block.title || 'טבלת נתונים',
                            contentMd: block.content,
                            createdAt: new Date().toISOString(),
                          },
                        })
                      )
                    }}
                    className="h-6 px-2 text-[10px] font-bold gap-1 text-sky-800 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer"
                    title="פתח טבלה זו בחלון רחב במסך גדול לתצוגה נוחה"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>חלון רחב ⛶</span>
                  </Button>
                </div>
              </div>

              {/* Table Content */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="border-b border-sky-200/70 dark:border-sky-800/60 bg-sky-500/[0.08] dark:bg-sky-900/40">
                      {block.headers.map((header, hIdx) => (
                        <th
                          key={hIdx}
                          className="p-3 font-black text-foreground text-xs whitespace-nowrap"
                        >
                          {renderRichInline(header, onCitationClick, onPromptClick)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100/80 dark:divide-sky-900/30">
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="hover:bg-sky-500/10 transition-colors odd:bg-transparent even:bg-muted/25"
                      >
                        {row.map((cell, cIdx) => {
                          const statusBadge = renderStatusBadge(cell)
                          return (
                            <td
                              key={cIdx}
                              className="p-3 text-xs whitespace-pre-wrap font-mono tabular-nums text-foreground/90"
                            >
                              {statusBadge || renderRichInline(cell, onCitationClick, onPromptClick)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        }

        // ── 2. Visual Bar Chart ───────────────────────────────────────────────
        if (block.type === 'chart' && block.chartItems) {
          const colorStyles: Record<string, { bar: string; dot: string; text: string; bg: string }> = {
            emerald: {
              bar: 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]',
              dot: 'bg-emerald-500',
              text: 'text-emerald-700 dark:text-emerald-400',
              bg: 'bg-emerald-500/10 border-emerald-500/20',
            },
            rose: {
              bar: 'bg-gradient-to-r from-rose-500 to-pink-500 shadow-[0_0_12px_rgba(244,63,94,0.35)]',
              dot: 'bg-rose-500',
              text: 'text-rose-700 dark:text-rose-400',
              bg: 'bg-rose-500/10 border-rose-500/20',
            },
            amber: {
              bar: 'bg-gradient-to-r from-amber-500 to-orange-400 shadow-[0_0_12px_rgba(245,158,11,0.35)]',
              dot: 'bg-amber-500',
              text: 'text-amber-700 dark:text-amber-400',
              bg: 'bg-amber-500/10 border-amber-500/20',
            },
            indigo: {
              bar: 'bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_12px_rgba(99,102,241,0.35)]',
              dot: 'bg-indigo-500',
              text: 'text-indigo-700 dark:text-indigo-400',
              bg: 'bg-indigo-500/10 border-indigo-500/20',
            },
            sky: {
              bar: 'bg-gradient-to-r from-sky-500 to-cyan-400 shadow-[0_0_12px_rgba(14,165,233,0.35)]',
              dot: 'bg-sky-500',
              text: 'text-sky-700 dark:text-sky-400',
              bg: 'bg-sky-500/10 border-sky-500/20',
            },
            violet: {
              bar: 'bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-[0_0_12px_rgba(139,92,246,0.35)]',
              dot: 'bg-violet-500',
              text: 'text-violet-700 dark:text-violet-400',
              bg: 'bg-violet-500/10 border-violet-500/20',
            },
          }

          return (
            <div
              key={idx}
              className="my-3.5 rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-500/[0.06] via-card to-background shadow-sm overflow-hidden"
            >
              {/* Chart Top Bar */}
              <div className="px-4 py-2.5 bg-indigo-500/10 dark:bg-indigo-950/40 border-b border-indigo-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-200">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center shadow-2xs">
                    <BarChart3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="font-extrabold text-sm text-foreground">{block.title}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 px-2 border-indigo-300 dark:border-indigo-700 bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 font-bold"
                  >
                    {block.chartItems.length} מדדים
                  </Badge>
                </div>

                <div className="flex items-center gap-1">
                  {showSaveButtons && onSaveArtifact && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onSaveArtifact(block.title || 'תרשים השוואתי', 'chart', block.content)
                      }
                      className="h-6 px-2 text-[10px] font-bold gap-1 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 cursor-pointer"
                      title="שמור תרשים זה לסטודיו"
                    >
                      <BookmarkPlus className="w-3 h-3" />
                      <span>שמור תרשים 📌</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('nehemiah_open_artifact_modal', {
                          detail: {
                            id: `preview_${Date.now()}`,
                            type: 'chart',
                            title: block.title || 'תרשים השוואתי',
                            contentMd: block.content,
                            createdAt: new Date().toISOString(),
                          },
                        })
                      )
                    }}
                    className="h-6 px-2 text-[10px] font-bold gap-1 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 cursor-pointer"
                    title="פתח תרשים זה בחלון רחב במסך גדול לתצוגה נוחה"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>חלון רחב ⛶</span>
                  </Button>
                </div>
              </div>

              {/* Chart Bars List */}
              <div className="p-4 space-y-3.5">
                {block.chartItems.map((item, cIdx) => {
                  const style = colorStyles[item.color] || colorStyles.indigo
                  return (
                    <div key={cIdx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                          <span className="font-bold text-foreground/90">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs sm:text-sm tabular-nums text-foreground">
                            {renderRichInline(item.value, onCitationClick, onPromptClick)}
                          </span>
                          {item.percentage > 0 && (
                            <span
                              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded font-mono ${style.bg} ${style.text}`}
                            >
                              {item.percentage}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bar track & fill */}
                      <div className="w-full h-2.5 rounded-full bg-muted/70 p-0.5 border border-border/30 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${style.bar}`}
                          style={{ width: `${Math.max(item.percentage, 4)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }

        // ── 3. Stat Metric Grid ───────────────────────────────────────────────
        if (block.type === 'stat_grid' && block.metrics) {
          return (
            <div
              key={idx}
              className="my-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
            >
              {block.metrics.map((metric, mIdx) => (
                <div
                  key={mIdx}
                  className="p-3.5 rounded-xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 via-card to-background shadow-2xs space-y-1 hover:border-indigo-500/40 transition-colors"
                >
                  <p className="text-[11px] font-bold text-muted-foreground truncate">
                    {metric.label}
                  </p>
                  <div className="text-base font-black text-foreground tracking-tight">
                    {renderRichInline(metric.value, onCitationClick, onPromptClick)}
                  </div>
                </div>
              ))}
            </div>
          )
        }

        // ── 4. KPI / Info Card ────────────────────────────────────────────────
        if (block.type === 'card' && block.title) {
          const cardBody = block.content.replace(/^###?\s+.*?\n/, '')

          return (
            <div
              key={idx}
              className="my-3.5 p-4 sm:p-5 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent shadow-xs space-y-3"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-violet-500/20 pb-2.5">
                <div className="flex items-center gap-2.5 text-xs font-black text-violet-950 dark:text-violet-200">
                  <div className="w-7 h-7 rounded-xl bg-violet-600/15 flex items-center justify-center shadow-2xs shrink-0">
                    <BarChart3 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <span className="text-sm font-extrabold tracking-tight text-foreground">
                    {block.title}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {showSaveButtons && onSaveArtifact && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onSaveArtifact(block.title!, 'card', block.content)}
                      className="h-6 px-2 text-[10px] font-bold gap-1 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 cursor-pointer"
                      title="שמור כרטיס זה לסטודיו"
                    >
                      <BookmarkPlus className="w-3 h-3" />
                      <span>שמור כרטיס 📌</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('nehemiah_open_artifact_modal', {
                          detail: {
                            id: `preview_${Date.now()}`,
                            type: 'card',
                            title: block.title!,
                            contentMd: block.content,
                            createdAt: new Date().toISOString(),
                          },
                        })
                      )
                    }}
                    className="h-6 px-2 text-[10px] font-bold gap-1 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 cursor-pointer"
                    title="פתח כרטיס זה בחלון רחב במסך גדול לתצוגה נוחה"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>חלון רחב ⛶</span>
                  </Button>
                </div>
              </div>

              {/* Card Body */}
              <div className="whitespace-pre-wrap leading-relaxed text-xs sm:text-sm text-foreground/90 space-y-2">
                {renderRichInline(cardBody, onCitationClick, onPromptClick)}
              </div>
            </div>
          )
        }

        // ── 5. Checklist / Action Plan ────────────────────────────────────────
        if (block.type === 'checklist' && block.items) {
          return (
            <div
              key={idx}
              className="my-3.5 p-4 rounded-2xl border border-amber-500/35 bg-amber-500/[0.05] dark:bg-amber-950/20 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900 dark:text-amber-300">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                    <CheckSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-sm">תוכנית פעולה ומשימות לביצוע</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 px-1.5 border-amber-400/50 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                  >
                    {block.items.length} יעדים
                  </Badge>
                </div>

                {showSaveButtons && onSaveArtifact && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onSaveArtifact('תוכנית פעולה', 'action_plan', block.content)}
                    className="h-6 px-2.5 text-[11px] font-bold gap-1 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 cursor-pointer"
                  >
                    <BookmarkPlus className="w-3 h-3" />
                    <span>שמור תוכנית 📌</span>
                  </Button>
                )}
              </div>

              <div className="space-y-2 pt-1">
                {block.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90 leading-normal"
                  >
                    {item.checked ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4 h-4 text-amber-600/70 dark:text-amber-400/70 shrink-0 mt-0.5" />
                    )}
                    <span className={item.checked ? 'line-through text-muted-foreground' : 'font-medium'}>
                      {renderRichInline(item.text, onCitationClick, onPromptClick)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        }

        // ── 6. Headings (H1, H2, H3, H4) ──────────────────────────────────────
        if (block.type === 'heading' && block.title) {
          const level = block.headingLevel || 2
          if (level === 1) {
            return (
              <h1
                key={idx}
                className="text-lg sm:text-xl font-black text-foreground border-b-2 border-indigo-500/30 pb-2 mt-4 mb-2 flex items-center gap-2"
              >
                <Sparkles className="w-5 h-5 text-indigo-500 shrink-0" />
                <span>{renderRichInline(block.title, onCitationClick, onPromptClick)}</span>
              </h1>
            )
          }
          if (level === 2) {
            return (
              <h2
                key={idx}
                className="text-base sm:text-lg font-black text-foreground border-r-4 border-indigo-500 pr-2.5 mt-3.5 mb-2"
              >
                {renderRichInline(block.title, onCitationClick, onPromptClick)}
              </h2>
            )
          }
          return (
            <h3
              key={idx}
              className="text-sm sm:text-base font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 mt-3 mb-1"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>{renderRichInline(block.title, onCitationClick, onPromptClick)}</span>
            </h3>
          )
        }

        // ── 7. Blockquote ─────────────────────────────────────────────────────
        if (block.type === 'blockquote') {
          return (
            <div
              key={idx}
              className="my-3 p-3.5 rounded-l-xl border-r-4 border-amber-500 bg-amber-500/[0.06] dark:bg-amber-950/20 text-xs sm:text-sm text-foreground/90 font-medium italic"
            >
              {renderRichInline(block.content, onCitationClick, onPromptClick)}
            </div>
          )
        }

        // ── 8. Lists (Bullet & Numbered) ──────────────────────────────────────
        if (block.type === 'list' && block.items) {
          return (
            <div key={idx} className="my-2 space-y-1.5 pr-1">
              {block.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className="flex items-start gap-2 text-xs sm:text-sm text-foreground/90 leading-relaxed"
                >
                  {item.number !== undefined ? (
                    <span className="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {item.number}
                    </span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-2" />
                  )}
                  <span className="flex-1">
                    {renderRichInline(item.text, onCitationClick, onPromptClick)}
                  </span>
                </div>
              ))}
            </div>
          )
        }

        // ── 9. Code Block ─────────────────────────────────────────────────────
        if (block.type === 'code_block') {
          return (
            <div
              key={idx}
              className="my-3 rounded-xl border border-border/70 bg-muted/60 overflow-hidden font-mono text-xs"
              dir="ltr"
            >
              <div className="px-3 py-1.5 bg-muted/90 border-b border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground/80">{block.language || 'code'}</span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(block.content, idx)}
                  className="flex items-center gap-1 hover:text-foreground p-1 rounded transition-colors"
                >
                  {copiedCodeIdx === idx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span>הועתק!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>העתק</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto text-foreground/90 leading-relaxed">
                <code>{block.content}</code>
              </pre>
            </div>
          )
        }

        // ── 10. Normal Paragraph ──────────────────────────────────────────────
        return (
          <p
            key={idx}
            className="text-xs sm:text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap"
          >
            {renderRichInline(block.content, onCitationClick, onPromptClick)}
          </p>
        )
      })}
    </div>
  )
}
