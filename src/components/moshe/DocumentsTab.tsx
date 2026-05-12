'use client'

import { useState, useTransition, useRef, useCallback, useEffect, Fragment } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ExternalLink, Trash2, Pencil, Plus, X, FolderOpen, FileText, Link2, Save, CheckCircle2, Eye, Loader2, Camera, FolderUp, RefreshCw, HardDrive, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { addDocument, deleteDocument, updateDocument, updateDriveLink } from '@/app/moshe/actions'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  webViewLink?: string
  modifiedTime?: string
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📋'
  if (mimeType === 'application/vnd.google-apps.folder') return '📁'
  return '📎'
}

function fmtBytes(bytes?: string) {
  if (!bytes) return ''
  const n = parseInt(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

interface FolderEntry { id: string; name: string }

function parseFolderId(url: string): string | null {
  const m = url.match(/folders\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : /^[a-zA-Z0-9_-]{20,}$/.test(url) ? url : null
}

function DriveBrowser({ folderUrl }: { folderUrl: string | null }) {
  const [stack, setStack]       = useState<FolderEntry[]>([])
  const [files, setFiles]       = useState<DriveFile[] | null>(null)
  const [loading, setLoading]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [preview, setPreview]   = useState<DriveFile | null>(null)

  useEffect(() => {
    if (!folderUrl) return
    const id = parseFolderId(folderUrl)
    if (id) setStack([{ id, name: 'תיקיית הדרייב' }])
  }, [folderUrl])

  const currentFolder = stack[stack.length - 1] ?? null

  const load = useCallback(async (folder: FolderEntry) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/moshe/drive-list?folder=${folder.id}`)
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      setFiles(data.files)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (currentFolder) {
      setFiles(null)
      load(currentFolder)
    }
  }, [currentFolder, load])

  function openFolder(file: DriveFile) {
    setStack(s => [...s, { id: file.id, name: file.name }])
  }

  function goBack() {
    setStack(s => s.slice(0, -1))
  }

  async function handleDelete(file: DriveFile) {
    if (!confirm(`למחוק את "${file.name}" מהדרייב? פעולה זו אינה הפיכה.`)) return
    setDeleting(file.id)
    try {
      const res  = await fetch(`/api/moshe/drive-file?fileId=${file.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      toast.success(`"${file.name}" נמחק מהדרייב`)
      setFiles(prev => prev?.filter(f => f.id !== file.id) ?? null)
    } finally {
      setDeleting(null)
    }
  }

  if (!folderUrl) return null

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-blue-500 shrink-0" />
          {stack.length > 1 && (
            <button onClick={goBack}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 shrink-0">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1 flex-1 min-w-0 text-sm">
            {stack.map((f, i) => (
              <Fragment key={f.id}>
                {i > 0 && <span className="text-slate-300 shrink-0">/</span>}
                <span className={`truncate ${i === stack.length - 1 ? 'font-bold text-slate-700' : 'text-slate-400'}`}>
                  {f.name}
                </span>
              </Fragment>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => currentFolder && load(currentFolder)} disabled={loading}
            className="text-xs gap-1.5 h-8 text-blue-600 hover:bg-blue-50 shrink-0">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            רענן
          </Button>
        </div>

        {loading && (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        )}

        {!loading && files !== null && files.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">התיקייה ריקה</p>
        )}

        {!loading && files !== null && files.length > 0 && (
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {files.map(file => {
              const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
              return (
                <div key={file.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 group">
                  <span className="text-base shrink-0">{fileIcon(file.mimeType)}</span>
                  {isFolder ? (
                    <button onClick={() => openFolder(file)} className="flex-1 min-w-0 text-right">
                      <p className="text-sm font-medium text-blue-600 truncate hover:underline">{file.name}</p>
                    </button>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {fmtBytes(file.size)}
                          {file.modifiedTime && ` · ${format(new Date(file.modifiedTime), 'dd/MM/yyyy', { locale: he })}`}
                        </p>
                      </div>
                      <button onClick={() => setPreview(file)}
                        className="w-7 h-7 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {file.webViewLink && (
                        <a href={file.webViewLink} target="_blank" rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 flex items-center justify-center shrink-0">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button onClick={() => handleDelete(file)} disabled={deleting === file.id}
                        className="w-7 h-7 rounded-lg text-slate-200 hover:text-red-400 hover:bg-red-50 flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {deleting === file.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={open => !open && setPreview(null)}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden" style={{ height: '82vh' }}>
          <DialogHeader className="px-4 py-3 border-b border-slate-100">
            <DialogTitle className="text-sm font-bold truncate">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && (
            <iframe
              src={`https://drive.google.com/file/d/${preview.id}/preview`}
              className="w-full"
              style={{ height: 'calc(82vh - 56px)', border: 'none' }}
              allow="autoplay"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

interface Document {
  id: string
  name: string
  url: string
  created_at: string
}

interface Props {
  projectId: string
  documents: Document[]
  driveFolderUrl?: string | null
}

export function DocumentsTab({ projectId, documents, driveFolderUrl }: Props) {
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [newDoc, setNewDoc] = useState({ name: '', url: '' })
  const [uploading, setUploading] = useState(false)
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (driveFolderUrl) fd.append('folderUrl', driveFolderUrl)
      const res = await fetch('/api/moshe/upload-drive', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) { toast.error(data.error ?? 'שגיאה בהעלאה'); return }
      const r = await addDocument({ project_id: projectId, name: data.name ?? file.name, url: data.url })
      if (r.error) { toast.error(r.error); return }
      toast.success(`"${file.name}" הועלה לדרייב ונשמר`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (cameraInputRef.current) cameraInputRef.current.value = ''
    }
  }
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDoc, setEditDoc] = useState({ name: '', url: '' })
  const [driveUrl, setDriveUrl] = useState(driveFolderUrl ?? '')
  const [editingDrive, setEditingDrive] = useState(false)
  const [driveSaving, setDriveSaving] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')

  async function handleAddDoc() {
    if (!newDoc.name.trim()) return toast.error('שם הקובץ נדרש')
    if (!newDoc.url.trim()) return toast.error('קישור נדרש')
    const r = await addDocument({ project_id: projectId, name: newDoc.name, url: newDoc.url })
    if (r.error) { toast.error(r.error); return }
    toast.success('מסמך נוסף')
    setNewDoc({ name: '', url: '' })
    setShowAdd(false)
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`למחוק את המסמך "${name}"?`)) return
    startTransition(async () => {
      const r = await deleteDocument(id, projectId)
      if (r.error) toast.error(r.error)
      else toast.success('מסמך נמחק')
    })
  }

  function startEdit(doc: Document) {
    setEditingId(doc.id)
    setEditDoc({ name: doc.name, url: doc.url })
  }

  function saveEdit(id: string) {
    startTransition(async () => {
      const r = await updateDocument(id, editDoc)
      if (r.error) { toast.error(r.error); return }
      toast.success('מסמך עודכן')
      setEditingId(null)
    })
  }

  async function saveDriveUrl() {
    setDriveSaving(true)
    try {
      const r = await updateDriveLink(projectId, driveUrl)
      if (r.error) { toast.error(r.error); return }
      toast.success('קישור דרייב עודכן')
      setEditingDrive(false)
    } finally {
      setDriveSaving(false)
    }
  }

  function getPreviewUrl(url: string): string | null {
    // Google Drive file URL patterns
    // https://drive.google.com/file/d/{id}/view
    const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
    if (driveFileMatch) {
      return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`
    }
    // Google Docs
    const docsMatch = url.match(/docs\.google\.com\/document\/d\/([^/]+)/)
    if (docsMatch) {
      return `https://docs.google.com/document/d/${docsMatch[1]}/preview`
    }
    // Google Sheets - use htmlview for horizontal scroll
    const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/)
    if (sheetsMatch) {
      return `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/htmlview?rm=minimal`
    }
    // Google Slides
    const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([^/]+)/)
    if (slidesMatch) {
      return `https://docs.google.com/presentation/d/${slidesMatch[1]}/preview`
    }
    // Direct PDF URL (use Google Docs Viewer)
    if (url.match(/\.pdf(\?|$)/i)) {
      return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`
    }
    return null
  }

  function openPreview(doc: Document) {
    const preview = getPreviewUrl(doc.url)
    if (!preview) {
      toast.error('\u05ea\u05e6\u05d5\u05d2\u05d4 \u05de\u05e7\u05d3\u05d9\u05de\u05d4 \u05d0\u05d9\u05e0\u05d4 \u05e0\u05ea\u05de\u05db\u05ea \u05dc\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d6\u05d4. \u05e0\u05ea\u05de\u05da \u05e2\u05dd Google Drive, Docs, Sheets, Slides \u05d0\u05d5 PDF.')
      return
    }
    setPreviewUrl(preview)
    setPreviewName(doc.name)
  }

  const canPreview = (url: string) => getPreviewUrl(url) !== null

  return (
    <div className="space-y-4">
      {/* Drive folder link */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-bold text-slate-700">תיקיית Google Drive</p>
          </div>
          {!editingDrive && (
            <Button size="sm" variant="ghost"
              onClick={() => setEditingDrive(true)}
              className="text-xs gap-1.5 h-8 text-slate-500 hover:text-amber-600 hover:bg-amber-50">
              <Pencil className="w-3.5 h-3.5" />
              {driveFolderUrl ? 'עריכה' : 'הוסף קישור'}
            </Button>
          )}
        </div>

        <div className="px-4 py-4">
          {editingDrive ? (
            <div className="flex gap-2 items-start">
              <div className="flex-1 relative">
                <Input
                  value={driveUrl}
                  onChange={e => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  dir="ltr"
                  className="h-10 border-slate-200 bg-white pl-9 text-sm"
                />
                <Link2 className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              </div>
              <Button size="sm" onClick={saveDriveUrl} disabled={driveSaving}
                className="h-10 bg-amber-500 hover:bg-amber-400 text-white gap-1.5 text-xs">
                {driveSaving ? '...' : <><Save className="w-3.5 h-3.5" />שמור</>}
              </Button>
              <button onClick={() => { setEditingDrive(false); setDriveUrl(driveFolderUrl ?? '') }}
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : driveFolderUrl ? (
            <a
              href={driveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              {driveFolderUrl}
            </a>
          ) : (
            <p className="text-sm text-slate-400">אין קישור לתיקיית דרייב. לחץ "הוסף קישור" להוספה.</p>
          )}
        </div>
      </div>

      {/* Documents list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <p className="text-sm font-bold text-slate-700">מסמכים ({documents.length})</p>
          </div>
          <div className="flex items-center gap-1.5">
            {/* hidden: any file (for desktop / gallery pick) */}
            <input ref={fileInputRef} type="file" accept="*/*" className="hidden" onChange={handleFileUpload} />
            {/* hidden: camera capture (mobile) */}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />

            {uploading ? (
              <span className="flex items-center gap-1 text-xs text-blue-600 px-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> מעלה...
              </span>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => cameraInputRef.current?.click()} disabled={uploading}
                  className="text-xs gap-1.5 h-8 text-blue-500 hover:bg-blue-50"
                  title="צלם תמונה (נייד)">
                  <Camera className="w-3.5 h-3.5" /> צלם
                </Button>
                <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="text-xs gap-1.5 h-8 text-blue-600 hover:bg-blue-50"
                  title="העלה קובץ מהמכשיר">
                  <FolderUp className="w-3.5 h-3.5" /> העלה
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(v => !v)}
              className="text-xs gap-1.5 h-8 text-amber-600 hover:bg-amber-50">
              <Plus className="w-3.5 h-3.5" /> קישור
            </Button>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="px-4 py-3 bg-amber-50/40 border-b border-amber-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-slate-400 mb-1">שם הקובץ / מסמך</p>
                <Input
                  placeholder='לדוגמה: "חוזה רכישה"'
                  value={newDoc.name}
                  onChange={e => setNewDoc(d => ({ ...d, name: e.target.value }))}
                  className="h-9 text-sm border-slate-200 bg-white"
                />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-1">קישור לקובץ</p>
                <div className="relative">
                  <Input
                    placeholder="https://..."
                    value={newDoc.url}
                    onChange={e => setNewDoc(d => ({ ...d, url: e.target.value }))}
                    dir="ltr"
                    className="h-9 text-sm border-slate-200 bg-white pl-8"
                  />
                  <Link2 className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setNewDoc({ name: '', url: '' }) }}
                className="h-8 text-xs">
                ביטול
              </Button>
              <Button size="sm" onClick={handleAddDoc}
                className="h-8 bg-amber-500 hover:bg-amber-400 text-white text-xs gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />הוסף
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="divide-y divide-slate-50">
          {documents.length === 0 && !showAdd && (
            <p className="text-center text-sm text-slate-400 py-10">
              אין מסמכים עדיין. לחץ "הוסף מסמך" להוספה.
            </p>
          )}
          {documents.map(doc => {
            if (editingId === doc.id) {
              return (
                <div key={doc.id} className="px-4 py-3 bg-amber-50/60 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">שם</p>
                      <Input value={editDoc.name}
                        onChange={e => setEditDoc(d => ({ ...d, name: e.target.value }))}
                        className="h-9 text-sm border-amber-200 bg-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">קישור</p>
                      <Input value={editDoc.url} dir="ltr"
                        onChange={e => setEditDoc(d => ({ ...d, url: e.target.value }))}
                        className="h-9 text-sm border-amber-200 bg-white" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 text-xs">ביטול</Button>
                    <Button size="sm" onClick={() => saveEdit(doc.id)} disabled={pending}
                      className="h-8 bg-amber-500 hover:bg-amber-400 text-white text-xs">שמור</Button>
                  </div>
                </div>
              )
            }

            return (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors group">
                <FileText className="w-4 h-4 text-slate-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{doc.name}</p>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-500 hover:text-blue-700 hover:underline truncate block"
                    dir="ltr"
                  >
                    {doc.url}
                  </a>
                </div>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 flex items-center justify-center transition-colors shrink-0"
                  title="פתח קישור"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {canPreview(doc.url) && (
                  <button onClick={() => openPreview(doc)}
                    title="\u05ea\u05e6\u05d5\u05d2\u05d4 \u05de\u05e7\u05d3\u05d9\u05de\u05d4"
                    className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-blue-500 hover:bg-blue-50 hover:border-blue-200 flex items-center justify-center transition-colors shrink-0">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => startEdit(doc)} disabled={pending}
                  className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-amber-500 hover:bg-amber-50 hover:border-amber-200 flex items-center justify-center transition-colors shrink-0">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(doc.id, doc.name)} disabled={pending}
                  className="w-7 h-7 rounded-lg text-slate-200 hover:text-red-400 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Drive folder browser */}
      <DriveBrowser folderUrl={driveFolderUrl ?? null} />

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={open => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] p-0 overflow-hidden">
          <DialogHeader className="px-5 py-3 border-b border-slate-100 shrink-0">
            <DialogTitle className="text-sm font-bold text-slate-700">{previewName}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full h-full min-h-0 overflow-auto">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-[calc(92vh-56px)] border-0"
                style={{ minWidth: '100%' }}
                allow="autoplay"
                title={previewName}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
