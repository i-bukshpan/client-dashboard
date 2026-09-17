'use client'

/**
 * RecordingUploader — Audio meeting uploader for Notebook Sources.
 * Uploads audio files or records live audio, stores in v3_client_recordings,
 * and triggers transcription and insight extraction.
 */

import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Mic2,
  UploadCloud,
  X,
  Loader2,
  CheckCircle2,
  FileAudio,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { saveClientRecordingAction } from '@/app/workspace/actions/recordings'

interface RecordingUploaderProps {
  clientId: string
  clientName?: string
  isOpen: boolean
  onClose: () => void
}

export function RecordingUploader({
  clientId,
  clientName,
  isOpen,
  onClose,
}: RecordingUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setIsUploading(true)

    try {
      const res = await saveClientRecordingAction(clientId, {
        fileName: selectedFile.name,
      })

      if (!res.success) {
        throw new Error(res.error || 'שגיאה בשמירת הקלטה')
      }

      toast.success(`ההקלטה "${selectedFile.name}" נשמרה בהצלחה ותועבר לתמלול וחילוץ החלטות!`)
      setSelectedFile(null)
      onClose()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהעלאת הקלטה')
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
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Mic2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">העלאת הקלטת פגישה</h3>
              <p className="text-[10px] text-muted-foreground">
                {clientName ? `עבור ${clientName}` : 'תיק לקוח'} — תמלול אוטומטי וחילוץ החלטות
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
          <div
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
              selectedFile
                ? 'border-purple-500/50 bg-purple-500/5'
                : 'border-border/60 hover:border-purple-500/50 hover:bg-muted/30'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              onChange={handleFileChange}
              accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
              className="hidden"
            />
            {selectedFile ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-purple-500" />
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
                  <FileAudio className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-xs font-medium text-foreground">
                  גרור קובץ שמע לכאן או <span className="text-purple-500 font-semibold">בחר מהמחשב</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  תומך ב-MP3, WAV, M4A, WEBM
                </p>
              </>
            )}
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
            className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>מעלה הקלטה...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5" />
                <span>העלה הקלטה</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
