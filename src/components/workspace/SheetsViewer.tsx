'use client'

/**
 * src/components/workspace/SheetsViewer.tsx
 *
 * SheetsViewer — renders a client's Google Sheet as a live table.
 * Features:
 * - Dynamic tab fetching and selector for multiple sheet tabs
 * - Sticky header row
 * - "Add Row" drawer with a dynamic form built from the header columns
 * - Optimistic UI: new row appears instantly, syncs in background
 * - Handles Hebrew tab names, empty sheets, and dynamically linked sheets
 */

import { useState, useEffect, useTransition, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  TableIcon,
  Plus,
  RefreshCw,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { getSheetDataAction, getSheetTabsAction, appendRowAction } from '@/app/admin/crm/[id]/actions-workspace'
import type { SheetMeta } from '@/lib/google-sheets'

interface SheetsViewerProps {
  clientId: string
  spreadsheetId: string | null
  tabs: SheetMeta[]
}

// ── Add Row Form ───────────────────────────────────────────────────────────────

function AddRowForm({
  headers,
  clientId,
  sheetName,
  onSuccess,
}: {
  headers: string[]
  clientId: string
  sheetName: string
  onSuccess: (values: string[]) => void
}) {
  const [values, setValues] = useState<string[]>(headers.map(() => ''))
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  function handleChange(i: number, val: string) {
    setValues((prev) => { const next = [...prev]; next[i] = val; return next })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await appendRowAction(clientId, sheetName, values)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('שורה נוספה בהצלחה')
        onSuccess(values)
        setValues(headers.map(() => ''))
        setOpen(false)
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 font-semibold shadow-xs">
          <Plus className="w-3.5 h-3.5" />
          הוסף שורה
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md" dir="rtl">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-right">הוסף שורה חדשה</SheetTitle>
          <SheetDescription className="text-right text-sm text-muted-foreground">
            הגיליון: <span className="font-medium text-foreground">{sheetName}</span>
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {headers.map((header, i) => (
            <div key={`form-field-${header || 'col'}-${i}`} className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {header || `עמודה ${i + 1}`}
              </Label>
              <Input
                value={values[i] || ''}
                onChange={(e) => handleChange(i, e.target.value)}
                placeholder={`הזן ${header || `עמודה ${i + 1}`}...`}
                dir="auto"
                className="h-9"
              />
            </div>
          ))}

          <div className="pt-4 border-t border-border">
            <Button
              type="submit"
              disabled={isPending}
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {isPending ? 'שומר...' : 'שמור שורה'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ── Table Skeleton ─────────────────────────────────────────────────────────────

function TableSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/70">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="text-right px-3 py-2.5">
                <Skeleton className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <tr key={row} className="border-b border-border/40">
              {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-3 py-3">
                  <Skeleton className="h-3.5 w-full" style={{ width: `${Math.random() * 40 + 40}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SheetsViewer({ clientId, spreadsheetId, tabs: initialTabs }: SheetsViewerProps) {
  const [tabList, setTabList] = useState<SheetMeta[]>(initialTabs || [])
  const [activeTab, setActiveTab] = useState<string>(initialTabs?.[0]?.title ?? '')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTabs, setLoadingTabs] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 1. Fetch tabs if not provided or if spreadsheet changed
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

  // 2. Load data for active tab
  const loadSheet = useCallback(async (sheetName: string) => {
    if (!spreadsheetId || !sheetName) return
    setLoading(true)
    setError(null)
    try {
      const result = await getSheetDataAction(clientId, sheetName)
      if ('error' in result) throw new Error(result.error)
      setHeaders(result.headers || [])
      setRows(result.rows || [])
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'שגיאה בטעינת הגיליון')
    } finally {
      setLoading(false)
    }
  }, [clientId, spreadsheetId])

  useEffect(() => {
    if (!activeTab) return
    const timer = window.setTimeout(() => void loadSheet(activeTab), 0)
    return () => window.clearTimeout(timer)
  }, [activeTab, loadSheet])

  function handleAddRow(newValues: string[]) {
    setRows((prev) => [...prev, newValues])
  }

  const sheetsUrl = spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    : null

  // ── No sheet linked state ────────────────────────────────────────────────────
  if (!spreadsheetId) {
    return (
      <Card className="border-border/50 shadow-sm flex flex-col items-center justify-center py-20 text-center h-full">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4 shadow-sm">
          <TableIcon className="w-8 h-8 text-emerald-400" />
        </div>
        <p className="font-bold text-foreground text-base">אין גיליון מקושר</p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-[300px]">
          בחר גיליון מתוך ה-Drive Explorer באמצעות כפתור &quot;הגדר כגיליון ראשי&quot;, או בקש מסוכן ה-AI ליצור גיליון חדש.
        </p>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <CardHeader className="border-b border-border/50 bg-slate-50/50 py-3 px-5 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
              <TableIcon className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-foreground">Google Sheets</CardTitle>
              {activeTab && (
                <p className="text-[10px] text-muted-foreground">לשונית: {activeTab}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sheetsUrl && (
              <a
                href={sheetsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                פתח Sheets
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
              className="h-8 w-8 p-0"
              title="רענן נתוני גיליון"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingTabs ? 'animate-spin' : ''}`} />
            </Button>

            {headers.length > 0 && (
              <AddRowForm
                key={`toolbar-${activeTab}-${headers.join('|')}`}
                headers={headers}
                clientId={clientId}
                sheetName={activeTab}
                onSuccess={handleAddRow}
              />
            )}
          </div>
        </div>

        {/* Tab selector */}
        {tabList.length > 1 && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/40 overflow-x-auto">
            {tabList.map((tab) => (
              <button
                key={tab.title}
                onClick={() => setActiveTab(tab.title)}
                className={`
                  px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap
                  ${activeTab === tab.title
                    ? 'text-emerald-800 bg-emerald-100/70 shadow-xs'
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

      {/* Table body */}
      <CardContent className="p-0 flex-1 overflow-auto">
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
          <TableSkeleton cols={headers.length || 4} />
        )}

        {/* Empty / Initial State */}
        {!loading && !loadingTabs && !error && (!activeTab || (headers.length === 0 && rows.length === 0)) && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
              <TableIcon className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="font-bold text-foreground text-sm">הגיליון ריק או שטרם נטענו נתונים</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              לחץ על &quot;רענן&quot; או פתח את הגיליון ב-Google Sheets כדי להוסיף עמודות ונתונים
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                refreshTabs()
                if (activeTab) loadSheet(activeTab)
              }}
              className="mt-4 gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              רענן כעת
            </Button>
          </div>
        )}

        {/* Empty rows with existing headers */}
        {!loading && !loadingTabs && !error && headers.length > 0 && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
              <TableIcon className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="font-bold text-foreground text-sm">הגיליון ריק משורות נתונים</p>
            <p className="text-xs text-muted-foreground mt-1">
              העמודות הקיימות: {headers.join(', ')}
            </p>
            <div className="mt-4">
              <AddRowForm
                key={`empty-${activeTab}-${headers.join('|')}`}
                headers={headers}
                clientId={clientId}
                sheetName={activeTab}
                onSuccess={handleAddRow}
              />
            </div>
          </div>
        )}

        {/* Data table */}
        {!loading && !loadingTabs && !error && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-border shadow-xs">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center text-[10px] font-bold text-muted-foreground/60 border-r border-border/40">
                    #
                  </th>
                  {headers.map((header, colIdx) => (
                    <th
                      key={`th-${header || 'col'}-${colIdx}`}
                      className="px-4 py-2.5 text-right text-xs font-bold text-foreground/80 whitespace-nowrap border-r border-border/40 last:border-r-0"
                    >
                      {header || `עמודה ${colIdx + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr
                    key={`row-${rowIdx}`}
                    className={`
                      border-b border-border/40 transition-colors
                      ${rowIdx % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/40 hover:bg-slate-50/80'}
                    `}
                  >
                    <td className="px-3 py-2 text-center text-[10px] text-muted-foreground/50 font-mono border-r border-border/40">
                      {rowIdx + 1}
                    </td>
                    {headers.map((header, colIdx) => (
                      <td
                        key={`td-${rowIdx}-${colIdx}`}
                        className="px-4 py-2 text-right text-sm text-foreground/90 whitespace-nowrap border-r border-border/40 last:border-r-0 max-w-[220px] truncate"
                        title={row[colIdx] ?? ''}
                      >
                        {row[colIdx] ?? (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Footer */}
      {rows.length > 0 && (
        <div className="px-5 py-2.5 border-t border-border/50 bg-slate-50/50 shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            {rows.length} שורות · {headers.length} עמודות
          </p>
          {sheetsUrl && (
            <a
              href={sheetsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              עריכה ב-Sheets
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      )}
    </Card>
  )
}
