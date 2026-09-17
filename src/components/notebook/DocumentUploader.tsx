'use client'

/**
 * DocumentUploader — Drag-and-drop document upload modal for Notebook Sources.
 * Uploads to /api/v2/docs/upload and queues for OCR/RAG indexing.
 */

import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  UploadCloud,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface DocumentUploaderProps {
  clientId: string
  clientName?: string
  isOpen: boolean
  onClose: () => void
}

const DOC_TYPES = [
  { value: 'report', label: 'דוח כספי / רוו״ה' },
  { value: 'contract', label: 'חוזה / הסכם' },
  { value: 'invoice', label: 'חשבונית / קבלה' },
  { value: 'receipt', label: 'מסמך בנקאי' },
  { value: 'other', label: 'אחר / כללי' },
]

export function DocumentUploader({
  clientId,
  clientName,
  isOpen,
  onClose,
}: DocumentUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [docType, setDocType] = useState('report')
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  if (!isOpen) return null

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('client_id', clientId)
      formData.append('file_type', docType)

      const res = await fetch('/api/v2/docs/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בהעלאת המסמך')
      }

      toast.success(`הקובץ "${selectedFile.name}" הועלה בהצלחה ונשלח לפענוח OCR ואינדוקס RAG!`)
      setSelectedFile(null)
      onClose()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהעלאת המסמך')
    } finally {
      setIsUploading(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">העלאת מסמך למקורות</h3>
              <p className="text-[10px] text-muted-foreground">
                {clientName ? `עבור ${clientName}` : 'תיק לקוח'} — כולל סריקת OCR וחיפוש RAG
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
              dragActive
                ? 'border-amber-500 bg-amber-500/5 scale-[0.99]'
                : selectedFile
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-border/60 hover:border-amber-500/50 hover:bg-muted/30'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
              className="hidden"
            />
            {selectedFile ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <p className="text-xs font-semibold text-foreground truncate max-w-[280px]">
                  {selectedFile.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • לחץ להחלפה
                </p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <UploadCloud className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-xs font-medium text-foreground">
                  גרור קובץ לכאן או <span className="text-amber-500 font-semibold">בחר מהמחשב</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  תומך ב-PDF, Word, Excel, תמונות (עד 25MB)
                </p>
              </>
            )}
          </div>

          {/* Doc Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">סיווג המסמך:</label>
            <div className="flex flex-wrap gap-1.5">
              {DOC_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setDocType(t.value)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    docType === t.value
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isUploading}>
            ביטול
          </Button>
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>מעלה ומאנדקס...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5" />
                <span>העלה מסמך</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
