'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ExternalLink, Trash2, Pencil, Plus, X, FolderOpen, FileText, Link2, Save, CheckCircle2 } from 'lucide-react'
import { addDocument, deleteDocument, updateDocument, updateDriveLink } from '@/app/moshe/actions'
import { toast } from 'sonner'

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDoc, setEditDoc] = useState({ name: '', url: '' })
  const [driveUrl, setDriveUrl] = useState(driveFolderUrl ?? '')
  const [editingDrive, setEditingDrive] = useState(false)
  const [driveSaving, setDriveSaving] = useState(false)

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
          <Button size="sm" variant="ghost" onClick={() => setShowAdd(v => !v)}
            className="text-xs gap-1.5 h-8 text-amber-600 hover:bg-amber-50">
            <Plus className="w-3.5 h-3.5" /> הוסף מסמך
          </Button>
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
                <button onClick={() => startEdit(doc)} disabled={pending}
                  className="w-7 h-7 rounded-lg text-slate-200 hover:text-amber-500 hover:bg-amber-50 flex items-center justify-center transition-colors shrink-0 opacity-0 group-hover:opacity-100">
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
    </div>
  )
}
