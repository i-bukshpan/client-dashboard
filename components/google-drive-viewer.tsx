'use client'

import { useState } from 'react'
import { ExternalLink, FileText, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function parseGoogleDriveUrl(url: string): { id: string; type: 'doc' | 'sheet' | 'slide' | 'file' } | null {
  const docMatch = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (docMatch) return { id: docMatch[1], type: 'doc' }
  const sheetMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (sheetMatch) return { id: sheetMatch[1], type: 'sheet' }
  const slideMatch = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/)
  if (slideMatch) return { id: slideMatch[1], type: 'slide' }
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) return { id: fileMatch[1], type: 'file' }
  return null
}

function getEmbedUrl(id: string, type: 'doc' | 'sheet' | 'slide' | 'file'): string {
  switch (type) {
    case 'doc': return `https://docs.google.com/document/d/${id}/preview`
    case 'sheet': return `https://docs.google.com/spreadsheets/d/${id}/preview`
    case 'slide': return `https://docs.google.com/presentation/d/${id}/preview`
    case 'file': return `https://drive.google.com/file/d/${id}/preview`
  }
}

function getTypeLabel(type: 'doc' | 'sheet' | 'slide' | 'file'): string {
  switch (type) {
    case 'doc': return 'Google Docs'
    case 'sheet': return 'Google Sheets'
    case 'slide': return 'Google Slides'
    case 'file': return 'Google Drive'
  }
}

interface GoogleDriveViewerProps {
  initialUrl?: string
}

export function GoogleDriveViewer({ initialUrl }: GoogleDriveViewerProps) {
  const [url, setUrl] = useState(initialUrl || '')
  const [activeUrl, setActiveUrl] = useState(initialUrl || '')
  const [key, setKey] = useState(0)

  const parsed = activeUrl ? parseGoogleDriveUrl(activeUrl) : null
  const embedUrl = parsed ? getEmbedUrl(parsed.id, parsed.type) : null

  function handleLoad() {
    if (url.trim()) {
      setActiveUrl(url.trim())
      setKey(k => k + 1)
    }
  }

  function handleClear() {
    setUrl('')
    setActiveUrl('')
  }

  return (
    <div className="space-y-4">
      {/* URL Input */}
      <div className="space-y-2">
        <Label className="font-bold text-sm">קישור Google Drive / Docs / Sheets</Label>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLoad()}
            placeholder="הדבק קישור לקובץ Google Drive..."
            className="rounded-xl h-10 flex-1 text-sm"
            dir="ltr"
          />
          {activeUrl && (
            <Button variant="ghost" size="icon" onClick={handleClear} className="h-10 w-10 rounded-xl text-grey hover:text-navy">
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={handleLoad} disabled={!url.trim()} className="h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold">
            פתח
          </Button>
        </div>
        {activeUrl && !parsed && (
          <p className="text-xs text-red-500 font-medium">לא זוהה כקישור תקני של Google Drive. ודא שמדובר בקישור שיתוף.</p>
        )}
        {parsed && (
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {getTypeLabel(parsed.type)} — קובץ מוכן לתצוגה
            <a href={activeUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
              פתח מקור <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        )}
      </div>

      {/* Embed Frame */}
      {embedUrl && (
        <div className="relative rounded-2xl border border-border overflow-hidden bg-slate-50" style={{ height: 520 }}>
          <div className="absolute top-2 left-2 z-10 flex gap-1.5">
            <button
              onClick={() => setKey(k => k + 1)}
              className="h-7 w-7 rounded-lg bg-white border border-border shadow-sm flex items-center justify-center text-grey hover:text-navy transition-colors"
              title="רענן"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 w-7 rounded-lg bg-white border border-border shadow-sm flex items-center justify-center text-grey hover:text-navy transition-colors"
              title="פתח בחלון חדש"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <iframe
            key={key}
            src={embedUrl}
            className="w-full h-full border-0"
            title="Google Drive Viewer"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      )}

      {!embedUrl && (
        <div className="py-16 text-center bg-slate-50/50 border border-dashed border-border rounded-2xl">
          <FileText className="h-12 w-12 text-slate-200 mx-auto mb-4" />
          <p className="text-navy font-bold mb-1">הדבק קישור לקובץ Google</p>
          <p className="text-sm text-grey">תומך ב-Docs, Sheets, Slides, Drive</p>
        </div>
      )}
    </div>
  )
}
