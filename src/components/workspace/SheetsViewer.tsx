'use client'

/**
 * src/components/workspace/SheetsViewer.tsx
 *
 * SheetsViewer — authentic Google Sheets / Excel live spreadsheet editor.
 * Features:
 * - Real Google Sheets column letters (A, B, C, D...) & sticky row numbers (1, 2, 3...)
 * - In-table direct row entry (fill a new row directly in the table grid, press Enter to commit)
 * - Automatic background realtime sync from Google Sheets (detects external edits)
 * - Dynamic tab fetching and selector for multiple sheet tabs
 * - Handles Hebrew tab names, empty sheets, and dynamically linked sheets
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TableIcon,
  Plus,
  RefreshCw,
  AlertCircle,
  Loader2,
  ExternalLink,
  Check,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { getSheetDataAction, getSheetTabsAction, appendRowAction } from '@/app/admin/crm/[id]/actions-workspace'
import type { SheetMeta } from '@/lib/google-sheets'

interface SheetsViewerProps {
  clientId: string
  spreadsheetId: string | null
  tabs: SheetMeta[]
}

/**
 * Converts a 0-based column index to an Excel/Sheets column letter (0 -> A, 25 -> Z, 26 -> AA).
 */
function getColumnLetter(colIndex: number): string {
  let temp = colIndex + 1
  let letter = ''
  while (temp > 0) {
    const mod = (temp - 1) % 26
    letter = String.fromCharCode(65 + mod) + letter
    temp = Math.floor((temp - mod) / 26)
  }
  return letter
}

export function SheetsViewer({ clientId, spreadsheetId, tabs: initialTabs }: SheetsViewerProps) {
  const [tabList, setTabList] = useState<SheetMeta[]>(initialTabs || [])
  const [activeTab, setActiveTab] = useState<string>(initialTabs?.[0]?.title ?? '')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTabs, setLoadingTabs] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [gridScrollTop, setGridScrollTop] = useState(0)

  // In-table new row inputs
  const [newRowValues, setNewRowValues] = useState<Record<number, string>>({})
  const [isAppending, setIsAppending] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)

  // 1. Fetch tabs if needed
  const refreshTabs = useCallback(async () => {
    if (!spreadsheetId) return
    setLoadingTabs(true)
    try {
      const res = await getSheetTabsAction(clientId)
      if ('data' in res && res.data.length > 0) {
        setTabList(res.data)
        setActiveTab((prev) => {
          if (prev && res.data.some((t) => t.title === prev)) return prev
          return res.data[0].title
        })
      }
    } catch (error: unknown) {
      console.warn('Failed to load tabs:', error instanceof Error ? error.message : error)
    } finally {
      setLoadingTabs(false)
    }
  }, [clientId, spreadsheetId])

  useEffect(() => {
    if (initialTabs.length > 0 || !spreadsheetId) return
    const timer = window.setTimeout(() => void refreshTabs(), 0)
    return () => window.clearTimeout(timer)
  }, [spreadsheetId, initialTabs.length, refreshTabs])

  // 2. Load data for active tab (silent option for background polling)
  const loadSheet = useCallback(
    async (sheetName: string, isBackground = false) => {
      if (!spreadsheetId || !sheetName) return
      if (!isBackground) setLoading(true)
      setError(null)
      try {
        const result = await getSheetDataAction(clientId, sheetName)
        if ('error' in result) throw new Error(result.error)
        setHeaders(result.headers || [])
        const cleanRows = (result.rows || []).filter((r) =>
          r.some((c) => c !== null && c !== undefined && String(c).trim() !== '')
        )
        setRows(cleanRows)
        setLastSynced(new Date())
      } catch (error: unknown) {
        if (!isBackground) {
          setError(error instanceof Error ? error.message : 'שגיאה בטעינת הגיליון')
        }
      } finally {
        if (!isBackground) setLoading(false)
      }
    },
    [clientId, spreadsheetId]
  )

  useEffect(() => {
    if (!activeTab) return
    const timer = window.setTimeout(() => void loadSheet(activeTab), 0)
    return () => window.clearTimeout(timer)
  }, [activeTab, loadSheet])

  // 3. Realtime polling when tab is active (every 7 seconds)
  useEffect(() => {
    if (!activeTab || !spreadsheetId) return
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !isAppending) {
        void loadSheet(activeTab, true)
      }
    }, 7000)

    const onFocus = () => {
      if (!isAppending) void loadSheet(activeTab, true)
    }
    window.addEventListener('focus', onFocus)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [activeTab, spreadsheetId, loadSheet, isAppending])

  // 4. Handle Direct In-Table Row Input Change
  const handleCellChange = (colIdx: number, val: string) => {
    setNewRowValues((prev) => ({ ...prev, [colIdx]: val }))
  }

  // 5. Submit new row directly from the table grid
  const handleCommitNewRow = async () => {
    if (!headers.length || isAppending) return
    const valuesArray = headers.map((_, i) => (newRowValues[i] || '').trim())
    const hasAnyContent = valuesArray.some((v) => v.length > 0)
    if (!hasAnyContent) {
      toast.info('נא למלא לפחות תא אחד בשורה החדשה')
      return
    }

    setIsAppending(true)
    // Optimistic UI update: instantly append to rows
    setRows((prev) => [...prev, valuesArray])
    setNewRowValues({})

    const toastId = toast.loading('שומר שורה חדשה ב-Google Sheets...')
    try {
      const res = await appendRowAction(clientId, activeTab, valuesArray)
      if ('error' in res) {
        toast.error(res.error, { id: toastId })
      } else {
        toast.success('✅ שורה נוספה וסונכרנה בהצלחה!', { id: toastId })
        setLastSynced(new Date())
      }
    } catch (err) {
      toast.error('שגיאה בשמירת השורה', { id: toastId })
    } finally {
      setIsAppending(false)
      // Refocus first cell for continuous row entry
      setTimeout(() => {
        firstInputRef.current?.focus()
      }, 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, colIdx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleCommitNewRow()
    }
  }

  const sheetsUrl = spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    : null
  const rowHeight = 33
  const overscan = 12
  const firstVisibleRow = Math.max(0, Math.floor(gridScrollTop / rowHeight) - overscan)
  const visibleRowCount = 50 + overscan * 2
  const virtualRows = useMemo(
    () => rows.slice(firstVisibleRow, firstVisibleRow + visibleRowCount),
    [rows, firstVisibleRow, visibleRowCount]
  )

  // ── No sheet linked state ────────────────────────────────────────────────────
  if (!spreadsheetId) {
    return (
      <Card className="border-border/50 shadow-sm flex flex-col items-center justify-center py-20 text-center h-full">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4 shadow-sm">
          <TableIcon className="w-8 h-8 text-emerald-500" />
        </div>
        <p className="font-bold text-foreground text-base">אין גיליון מקושר</p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-[300px]">
          בחר גיליון מתוך ה-Drive Explorer באמצעות כפתור &quot;הגדר כגיליון ראשי&quot;, או בקש מסוכן ה-AI ליצור גיליון חדש.
        </p>
      </Card>
    )
  }

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden flex flex-col h-full bg-card">
      {/* Header bar */}
      <CardHeader className="border-b border-border/60 bg-muted/20 py-2.5 px-4 shrink-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shadow-xs">
              <TableIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-foreground">Google Sheets</CardTitle>
                <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
                  ● סנכרון Realtime חי
                </Badge>
              </div>
              {lastSynced && (
                <p className="text-[10px] text-muted-foreground">
                  עודכן {lastSynced.toLocaleTimeString('he-IL')} · סנכרון אוטומטי מול הענן
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sheetsUrl && (
              <a
                href={sheetsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-xs"
              >
                <ExternalLink className="w-3 h-3" />
                פתח ב-Google Sheets
              </a>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refreshTabs()
                if (activeTab) loadSheet(activeTab)
              }}
              disabled={loading || loadingTabs}
              className="h-8 gap-1.5 text-xs font-semibold"
              title="רענן נתוני גיליון"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingTabs ? 'animate-spin' : ''}`} />
              סנכרן עכשיו
            </Button>
          </div>
        </div>

        {/* Tab selector */}
        {tabList.length > 1 && (
          <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/40 overflow-x-auto">
            {tabList.map((tab) => (
              <button
                key={tab.title}
                onClick={() => setActiveTab(tab.title)}
                className={`
                  px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap
                  ${
                    activeTab === tab.title
                      ? 'text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }
                `}
              >
                {tab.title}
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      {/* Spreadsheet Table Grid */}
      <CardContent
        className="p-0 flex-1 overflow-auto bg-slate-50/30 dark:bg-slate-950/20"
        onScroll={(event) => setGridScrollTop(event.currentTarget.scrollTop)}
      >
        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 m-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">שגיאה בטעינת הגיליון</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {(loading || loadingTabs) && !error && (
          <div className="p-6 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {/* Empty / Initial State */}
        {!loading && !loadingTabs && !error && (!activeTab || (headers.length === 0 && rows.length === 0)) && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center mb-3">
              <TableIcon className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="font-bold text-foreground text-sm">הגיליון ריק או שטרם נטענו נתונים</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              לחץ על &quot;סנכרן עכשיו&quot; או פתח את הגיליון ב-Google Sheets
            </p>
          </div>
        )}

        {/* Live Spreadsheet Grid with Column Letters & In-Table Row Addition */}
        {!loading && !loadingTabs && !error && headers.length > 0 && (
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-xs border-collapse border border-border/80">
              {/* Sticky Top: Row 1 = Column Letters (A, B, C, D...), Row 2 = Column Headers */}
              <thead className="sticky top-0 z-10 shadow-xs select-none">
                {/* 1. COLUMN LETTERS (A, B, C, D...) */}
                <tr className="bg-slate-200/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-border/80 text-[11px] font-mono font-bold">
                  <th className="w-12 px-2 py-1 text-center border-r border-border/80 bg-slate-300/80 dark:bg-slate-700/80 text-muted-foreground">
                    fx
                  </th>
                  {headers.map((_, colIdx) => (
                    <th
                      key={`col-letter-${colIdx}`}
                      className="px-3 py-1 text-center border-r border-border/80 last:border-r-0 tracking-wider"
                    >
                      {getColumnLetter(colIdx)}
                    </th>
                  ))}
                </tr>

                {/* 2. COLUMN HEADERS (Hebrew names from Google Sheets) */}
                <tr className="bg-slate-100 dark:bg-slate-900 text-foreground border-b border-border shadow-xs">
                  <th className="w-12 px-2 py-2 text-center text-[10px] font-bold text-muted-foreground/70 border-r border-border/80 bg-slate-200/60 dark:bg-slate-800/60">
                    #
                  </th>
                  {headers.map((header, colIdx) => (
                    <th
                      key={`th-${header || 'col'}-${colIdx}`}
                      className="px-3.5 py-2.5 text-right font-black text-foreground whitespace-nowrap border-r border-border/80 last:border-r-0"
                    >
                      {header || `עמודה ${colIdx + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {/* Existing Data Rows with Row Numbers */}
                {firstVisibleRow > 0 && (
                  <tr aria-hidden="true"><td colSpan={headers.length + 1} style={{ height: firstVisibleRow * rowHeight }} /></tr>
                )}
                {virtualRows.map((row, visibleIndex) => {
                  const rowIdx = firstVisibleRow + visibleIndex
                  return (
                  <tr
                    key={`row-${rowIdx}`}
                    className={`
                      border-b border-border/60 transition-colors
                      ${rowIdx % 2 === 0 ? 'bg-white dark:bg-card hover:bg-slate-100/70 dark:hover:bg-slate-900/60' : 'bg-slate-50/70 dark:bg-slate-900/30 hover:bg-slate-100/70 dark:hover:bg-slate-900/60'}
                    `}
                  >
                    <td className="px-2 py-2 text-center text-[10px] text-muted-foreground/70 font-mono font-bold bg-slate-100/80 dark:bg-slate-800/50 border-r border-border/80 select-none">
                      {rowIdx + 1}
                    </td>
                    {headers.map((_, colIdx) => (
                      <td
                        key={`td-${rowIdx}-${colIdx}`}
                        className="px-3.5 py-2 text-right text-xs text-foreground whitespace-nowrap border-r border-border/60 last:border-r-0 max-w-[260px] truncate"
                        title={row[colIdx] ?? ''}
                      >
                        {row[colIdx] ?? (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  )
                })}
                {firstVisibleRow + virtualRows.length < rows.length && (
                  <tr aria-hidden="true"><td colSpan={headers.length + 1} style={{ height: (rows.length - firstVisibleRow - virtualRows.length) * rowHeight }} /></tr>
                )}

                {/* DIRECT IN-TABLE NEW ROW INPUT (מילוי שורה ישירות בתוך הטבלה כמו ב-Google Sheets!) */}
                <tr className="bg-emerald-50/60 dark:bg-emerald-950/30 border-t-2 border-emerald-500/80">
                  <td className="px-2 py-1.5 text-center text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-900/50 border-r border-border/80 select-none">
                    {rows.length + 1}*
                  </td>
                  {headers.map((header, colIdx) => (
                    <td
                      key={`new-row-cell-${colIdx}`}
                      className="p-1 border-r border-border/60 last:border-r-0"
                    >
                      <input
                        ref={colIdx === 0 ? firstInputRef : undefined}
                        type="text"
                        placeholder={`הזן ${header || `עמודה ${colIdx + 1}`}...`}
                        value={newRowValues[colIdx] || ''}
                        onChange={(e) => handleCellChange(colIdx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, colIdx)}
                        className="w-full h-8 px-2.5 text-xs bg-white dark:bg-card border border-emerald-400/50 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-foreground font-medium placeholder:text-muted-foreground/50 shadow-2xs"
                        dir="auto"
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Footer bar with quick shortcut indicator */}
      {headers.length > 0 && (
        <div className="px-4 py-2 border-t border-border/60 bg-muted/20 shrink-0 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="font-semibold text-foreground">
              {rows.length} שורות · {headers.length} עמודות (A עד {getColumnLetter(headers.length - 1)})
            </span>
            <span className="hidden sm:inline text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md font-medium">
              💡 טיפ: מלא את השורה המסומנת בירוק ולחץ Enter להוספה מיידית לגיליון!
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleCommitNewRow}
              disabled={isAppending}
              className="h-7 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-xs"
            >
              {isAppending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              הוסף שורה (Enter)
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
