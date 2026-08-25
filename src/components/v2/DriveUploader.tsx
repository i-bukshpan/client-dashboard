'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, X, FileText, FileImage, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type FileType = 'receipt' | 'invoice' | 'contract' | 'report' | 'other'

interface UploadedDoc {
  id: string
  file_name: string
  drive_url: string
  ocr_status: string
}

interface QueuedFile {
  id: string            // local only
  file: File
  fileType: FileType
  status: 'idle' | 'uploading' | 'done' | 'error'
  progress: number
  result?: UploadedDoc
  error?: string
}

interface DriveUploaderProps {
  clientId: string
  clientName?: string
  onUploadComplete?: (doc: UploadedDoc) => void
  className?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FILE_TYPE_LABELS: Record<FileType, string> = {
  receipt:  'קבלה',
  invoice:  'חשבונית',
  contract: 'חוזה',
  report:   'דוח',
  other:    'אחר',
}

const ACCEPTED_TYPES = [
  '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic',
  '.doc', '.docx', '.xls', '.xlsx', '.txt',
].join(',')

function getFileIcon(file: File) {
  if (file.type.includes('pdf'))   return <FileText  className="w-5 h-5 text-red-500" />
  if (file.type.includes('image')) return <FileImage className="w-5 h-5 text-blue-500" />
  if (file.type.includes('sheet') || file.type.includes('excel'))
    return <FileSpreadsheet className="w-5 h-5 text-green-600" />
  return <FileText className="w-5 h-5 text-slate-500" />
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DriveUploader({
  clientId,
  clientName,
  onUploadComplete,
  className = '',
}: DriveUploaderProps) {
  const [queue, setQueue]     = useState<QueuedFile[]>([])
  const [isDragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── helpers ───────────────────────────────────────────────────────────────

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: QueuedFile[] = Array.from(files).map(file => ({
      id:       `${Date.now()}-${Math.random()}`,
      file,
      fileType: 'other',
      status:   'idle',
      progress: 0,
    }))
    setQueue(prev => [...prev, ...newItems])
  }, [])

  const removeFile = (id: string) =>
    setQueue(prev => prev.filter(f => f.status !== 'uploading' && f.id !== id))

  const setFileType = (id: string, fileType: FileType) =>
    setQueue(prev => prev.map(f => f.id === id ? { ...f, fileType } : f))

  // ── upload single file ────────────────────────────────────────────────────

  const uploadFile = useCallback(async (item: QueuedFile) => {
    setQueue(prev => prev.map(f =>
      f.id === item.id ? { ...f, status: 'uploading', progress: 10 } : f
    ))

    const formData = new FormData()
    formData.append('file', item.file)
    formData.append('client_id', clientId)
    formData.append('file_type', item.fileType)

    try {
      // Simulate gradual progress while uploading
      const progressInterval = setInterval(() => {
        setQueue(prev => prev.map(f =>
          f.id === item.id && f.status === 'uploading' && f.progress < 85
            ? { ...f, progress: f.progress + 15 }
            : f
        ))
      }, 400)

      const res = await fetch('/api/v2/docs/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'שגיאה לא ידועה' }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json()
      const doc = data.document as UploadedDoc

      setQueue(prev => prev.map(f =>
        f.id === item.id ? { ...f, status: 'done', progress: 100, result: doc } : f
      ))

      onUploadComplete?.(doc)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'שגיאה בהעלאה'
      setQueue(prev => prev.map(f =>
        f.id === item.id ? { ...f, status: 'error', progress: 0, error: message } : f
      ))
    }
  }, [clientId, onUploadComplete])

  const uploadAll = useCallback(() => {
    queue.filter(f => f.status === 'idle').forEach(uploadFile)
  }, [queue, uploadFile])

  // ── drag & drop ───────────────────────────────────────────────────────────

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }, [addFiles])

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  // ── computed ──────────────────────────────────────────────────────────────

  const idleFiles     = queue.filter(f => f.status === 'idle')
  const uploadingCount = queue.filter(f => f.status === 'uploading').length
  const doneCount     = queue.filter(f => f.status === 'done').length
  const hasIdle       = idleFiles.length > 0

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col gap-4 ${className}`} dir="rtl">

      {/* ── Drop Zone ── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="גרור קבצים לכאן או לחץ לבחירה"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        className={[
          'relative flex flex-col items-center justify-center gap-3',
          'rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer',
          'transition-all duration-200 select-none',
          isDragging
            ? 'border-blue-500 bg-blue-500/8 scale-[1.01]'
            : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5',
        ].join(' ')}
      >
        <div className={[
          'flex h-14 w-14 items-center justify-center rounded-full transition-colors',
          isDragging ? 'bg-blue-500/20' : 'bg-muted',
        ].join(' ')}>
          <Upload className={`w-6 h-6 transition-colors ${isDragging ? 'text-blue-500' : 'text-muted-foreground'}`} />
        </div>

        <div className="text-center">
          <p className="font-medium text-foreground">
            {isDragging ? 'שחרר כאן' : 'גרור קבצים לכאן'}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            או <span className="text-primary font-medium underline underline-offset-2">לחץ לבחירה</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            PDF, תמונות, Word, Excel — עד 25MB לקובץ
          </p>
        </div>

        {clientName && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <span>📁</span>
            {clientName}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        aria-hidden="true"
        onChange={e => e.target.files && addFiles(e.target.files)}
      />

      {/* ── Queue ── */}
      {queue.length > 0 && (
        <div className="flex flex-col gap-2">

          {/* Summary bar */}
          {queue.length > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>
                {doneCount}/{queue.length} הועלו
                {uploadingCount > 0 && ` · ${uploadingCount} בתהליך`}
              </span>
              {hasIdle && (
                <button
                  onClick={uploadAll}
                  className="text-primary font-medium hover:underline"
                >
                  העלה הכל ({idleFiles.length})
                </button>
              )}
            </div>
          )}

          {/* File rows */}
          <div className="flex flex-col gap-2">
            {queue.map(item => (
              <FileRow
                key={item.id}
                item={item}
                onRemove={() => removeFile(item.id)}
                onUpload={() => uploadFile(item)}
                onTypeChange={type => setFileType(item.id, type)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── FileRow sub-component ──────────────────────────────────────────────────────

function FileRow({
  item,
  onRemove,
  onUpload,
  onTypeChange,
}: {
  item: QueuedFile
  onRemove: () => void
  onUpload: () => void
  onTypeChange: (t: FileType) => void
}) {
  const isDone      = item.status === 'done'
  const isError     = item.status === 'error'
  const isUploading = item.status === 'uploading'
  const isIdle      = item.status === 'idle'

  return (
    <div
      className={[
        'group relative flex flex-col gap-2 rounded-lg border p-3 transition-colors',
        isDone  ? 'border-green-500/30 bg-green-500/5'  : '',
        isError ? 'border-red-500/30 bg-red-500/5'      : '',
        isIdle || isUploading ? 'border-border bg-card' : '',
      ].join(' ')}
    >
      {/* Top row */}
      <div className="flex items-center gap-3">

        {/* Icon */}
        <div className="shrink-0">{getFileIcon(item.file)}</div>

        {/* Name + size */}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-foreground" title={item.file.name}>
            {item.file.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatBytes(item.file.size)}
          </span>
        </div>

        {/* Status icon */}
        <div className="shrink-0">
          {isUploading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          {isDone      && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          {isError     && <AlertCircle  className="w-4 h-4 text-red-500"   />}
        </div>

        {/* Remove (hidden while uploading) */}
        {!isUploading && (
          <button
            onClick={onRemove}
            aria-label="הסר קובץ"
            className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Controls row (idle only) */}
      {isIdle && (
        <div className="flex items-center gap-2 pr-8">
          {/* File type selector */}
          <select
            id={`file-type-${item.id}`}
            value={item.fileType}
            onChange={e => onTypeChange(e.target.value as FileType)}
            className={[
              'flex-1 rounded-md border border-input bg-background px-2 py-1',
              'text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring',
            ].join(' ')}
            aria-label="סוג מסמך"
          >
            {(Object.entries(FILE_TYPE_LABELS) as [FileType, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {/* Upload button */}
          <button
            onClick={onUpload}
            className={[
              'rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground',
              'transition-opacity hover:opacity-90 active:scale-95',
            ].join(' ')}
          >
            העלה
          </button>
        </div>
      )}

      {/* Progress bar */}
      {isUploading && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      )}

      {/* Done: Drive link */}
      {isDone && item.result && (
        <a
          href={item.result.drive_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 pr-8"
        >
          <ExternalLink className="w-3 h-3" />
          פתח ב-Drive
          <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
            ממתין ל-OCR
          </span>
        </a>
      )}

      {/* Error message */}
      {isError && item.error && (
        <p className="pr-8 text-xs text-red-500">{item.error}</p>
      )}
    </div>
  )
}
