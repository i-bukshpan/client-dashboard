'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import DriveUploader from '@/components/v2/DriveUploader'
import {
  Search, RefreshCw, FileText, FileImage, FileSpreadsheet,
  CheckCircle2, Clock, Loader2, AlertCircle, ExternalLink,
  ChevronDown, ChevronUp, Sparkles, Database, Upload,
  BookOpen, FlaskConical
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type OcrStatus = 'pending' | 'processing' | 'done' | 'failed'

interface V2Document {
  id: string
  file_name: string
  file_type: string
  ocr_status: OcrStatus
  drive_url: string | null
  file_date: string | null
  amount: number | null
  mime_type: string | null
  file_size_bytes: number | null
  created_at: string
  client_id: string
}

interface SearchSource {
  document_id: string
  file_name: string
  file_type: string
  file_date: string | null
  amount: number | null
  drive_url: string | null
  similarity: number
}

interface SearchResult {
  answer: string
  sources: SearchSource[]
  query: string
  chunks_found: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function OcrBadge({ status }: { status: OcrStatus }) {
  const map: Record<OcrStatus, { label: string; icon: React.ReactNode; cls: string }> = {
    pending:    { label: 'ממתין ל-OCR',  icon: <Clock      className="w-3 h-3" />, cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    processing: { label: 'בעיבוד...',    icon: <Loader2    className="w-3 h-3 animate-spin" />, cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    done:       { label: 'OCR הושלם',    icon: <CheckCircle2 className="w-3 h-3" />, cls: 'bg-green-100 text-green-700 border-green-200' },
    failed:     { label: 'שגיאת OCR',   icon: <AlertCircle className="w-3 h-3" />, cls: 'bg-red-100 text-red-700 border-red-200' },
  }
  const { label, icon, cls } = map[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {icon}{label}
    </span>
  )
}

function FileIcon({ mime }: { mime: string | null }) {
  if (!mime) return <FileText className="w-4 h-4 text-slate-400" />
  if (mime.includes('pdf'))   return <FileText className="w-4 h-4 text-red-400" />
  if (mime.includes('image')) return <FileImage className="w-4 h-4 text-blue-400" />
  if (mime.includes('sheet') || mime.includes('excel')) return <FileSpreadsheet className="w-4 h-4 text-green-500" />
  return <FileText className="w-4 h-4 text-slate-400" />
}

function formatBytes(b: number | null) {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatAmount(a: number | null) {
  if (!a) return null
  return `₪${a.toLocaleString('he-IL')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({ icon, title, children, defaultOpen = true }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5 font-semibold text-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function UploaderSection() {
  const [clientId, setClientId] = useState('')
  const [inputVal, setInputVal] = useState('')
  const [lastDoc, setLastDoc] = useState<{ file_name: string; drive_url: string | null } | null>(null)

  const handleApply = () => { setClientId(inputVal.trim()) }

  return (
    <div className="flex flex-col gap-4">
      {/* Client ID input */}
      <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3">
        <Database className="w-4 h-4 shrink-0 text-muted-foreground" />
        <input
          id="v2-test-client-id"
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleApply()}
          placeholder="הכנס Client UUID לבדיקה…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          dir="ltr"
        />
        <button
          onClick={handleApply}
          disabled={!inputVal.trim()}
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          הגדר
        </button>
      </div>

      {clientId ? (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            <span>מעלה לתיקיית לקוח: <code className="font-mono text-foreground">{clientId}</code></span>
          </div>
          <DriveUploader
            clientId={clientId}
            onUploadComplete={doc => setLastDoc(doc)}
          />
          {lastDoc && (
            <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="flex-1">הועלה: <strong>{lastDoc.file_name}</strong> — ממתין ל-OCR ב-n8n</span>
              {lastDoc.drive_url && (
                <a href={lastDoc.drive_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">
          הכנס Client UUID כדי להפעיל את ה-uploader
        </p>
      )}
    </div>
  )
}

// ── Documents Live Table ───────────────────────────────────────────────────────

function DocumentsTable() {
  const [docs, setDocs]       = useState<V2Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchDocs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/v2/docs/list')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setDocs(data.documents ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDocs()
    // Auto-refresh every 10s to catch n8n OCR updates
    intervalRef.current = setInterval(() => fetchDocs(true), 10_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchDocs])

  const pending   = docs.filter(d => d.ocr_status === 'pending').length
  const processing = docs.filter(d => d.ocr_status === 'processing').length
  const done      = docs.filter(d => d.ocr_status === 'done').length
  const failed    = docs.filter(d => d.ocr_status === 'failed').length

  return (
    <div className="flex flex-col gap-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'ממתין', value: pending,    cls: 'text-amber-600' },
          { label: 'בעיבוד', value: processing, cls: 'text-blue-600' },
          { label: 'הושלם', value: done,        cls: 'text-green-600' },
          { label: 'שגיאה', value: failed,      cls: 'text-red-500'  },
        ].map(s => (
          <div key={s.label} className="rounded-lg border bg-muted/20 p-3 text-center">
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Refresh button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">מתרענן אוטומטית כל 10 שניות</p>
        <button
          onClick={() => fetchDocs(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          רענן
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <FileText className="w-8 h-8 opacity-30" />
          <p className="text-sm">אין מסמכים עדיין. העלה קובץ ראשון!</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                {['שם קובץ', 'סוג', 'גודל', 'סטטוס OCR', 'תאריך', 'הועלה'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-right font-medium text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {docs.map(doc => (
                <tr key={doc.id} className="group hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileIcon mime={doc.mime_type} />
                      <span className="font-medium max-w-[200px] truncate" title={doc.file_name}>
                        {doc.file_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{doc.file_type}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatBytes(doc.file_size_bytes)}</td>
                  <td className="px-4 py-3"><OcrBadge status={doc.ocr_status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {doc.amount ? <span className="font-medium text-foreground">{formatAmount(doc.amount)}</span> : formatDate(doc.file_date)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDate(doc.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {doc.drive_url && (
                      <a
                        href={doc.drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── RAG Search Simulator ────────────────────────────────────────────────────

function RagSimulator() {
  const [query, setQuery]         = useState('')
  const [clientId, setClientId]   = useState('')
  const [result, setResult]       = useState<SearchResult | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const suggestions = [
    'כמה הוצאתי על אינסטלציה?',
    'מה הסכום הכולל בחשבוניות של ספטמבר?',
    'האם יש חוזה עם ספק X?',
    'מה הוצאות החומרים בפרויקט האחרון?',
  ]

  const handleSearch = async () => {
    if (!query.trim() || loading) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/v2/docs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), client_id: clientId.trim() || undefined }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error)
      }
      setResult(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בחיפוש')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Query input */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            id="v2-rag-query"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder='שאל שאלה בשפה חופשית, למשל: "כמה הוצאתי על חומרי בניין?"'
            className="flex-1 rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
          <button
            id="v2-rag-search-btn"
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            חפש
          </button>
        </div>

        {/* Client filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">סנן ללקוח ספציפי (UUID אופציונלי):</span>
          <input
            id="v2-rag-client-filter"
            type="text"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="Client UUID…"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono outline-none focus:ring-1 focus:ring-ring"
            dir="ltr"
          />
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">הצעות:</span>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => setQuery(s)}
              className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="relative">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">מחפש במסמכים ומייצר תשובה עם Gemini…</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="flex flex-col gap-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {/* Answer box */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-semibold text-primary text-sm">תשובת Gemini</span>
              <span className="mr-auto text-xs text-muted-foreground">
                נמצאו {result.chunks_found} קטעים רלוונטיים
              </span>
            </div>
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{result.answer}</p>
          </div>

          {/* Sources */}
          {result.sources.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">מקורות שנמצאו:</p>
              <div className="flex flex-col gap-2">
                {result.sources.map(src => (
                  <div key={src.document_id} className="flex items-center gap-3 rounded-lg border p-3">
                    <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{src.file_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{src.file_type}</span>
                        {src.file_date && <span className="text-xs text-muted-foreground">· {formatDate(src.file_date)}</span>}
                        {src.amount && <span className="text-xs font-medium text-foreground">· {formatAmount(src.amount)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                        {src.similarity}% דמיון
                      </div>
                      {src.drive_url && (
                        <a href={src.drive_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function V2TestPage() {
  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <FlaskConical className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Nehemiah OS V2 — סביבת בדיקות</h1>
              <p className="text-sm text-muted-foreground">RAG Pipeline · Google Drive · Gemini OCR</p>
            </div>
            <div className="mr-auto">
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                DEV ONLY — לא לייצור
              </span>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-4">
          <SectionCard icon={<Upload className="w-4 h-4" />} title="העלאת מסמך לבדיקה">
            <UploaderSection />
          </SectionCard>

          <SectionCard icon={<Database className="w-4 h-4" />} title="מסמכים V2 — סטטוס בזמן אמת">
            <DocumentsTable />
          </SectionCard>

          <SectionCard icon={<BookOpen className="w-4 h-4" />} title="סימולטור חיפוש חכם (RAG)" defaultOpen={true}>
            <RagSimulator />
          </SectionCard>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          V2 Test Dashboard · {new Date().getFullYear()} · נחמיה OS
        </p>
      </div>
    </div>
  )
}
