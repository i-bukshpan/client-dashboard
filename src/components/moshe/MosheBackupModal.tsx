'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Download,
  FileText,
  FileSpreadsheet,
  Database,
  HardDrive,
  Loader2,
  CheckCircle2,
  Printer,
} from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  trigger?: React.ReactNode
}

export function MosheBackupModal({ trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [loadingMode, setLoadingMode] = useState<string | null>(null)

  async function downloadBackup(
    format: 'html' | 'csv' | 'json',
    uploadToDrive: boolean = false,
    openInTab: boolean = false
  ) {
    const modeKey = `${format}-${uploadToDrive ? 'drive' : 'local'}-${openInTab ? 'tab' : 'dl'}`
    setLoadingMode(modeKey)
    try {
      const params = new URLSearchParams({ format })
      if (uploadToDrive) params.set('drive', '1')
      const url = `/api/moshe/backup?${params.toString()}`

      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'שגיאה בהפקת הגיבוי')
        return
      }

      const blob = await res.blob()
      const date = new Date().toISOString().slice(0, 10)
      const ext = format === 'html' ? 'html' : format === 'csv' ? 'csv' : 'json'
      const prefix = format === 'html' ? 'דוח-גיבוי-מלא-משה' : 'גיבוי-פורטל-משה'
      const fileName = `${prefix}-${date}.${ext}`

      const blobUrl = URL.createObjectURL(blob)

      if (openInTab && format === 'html') {
        window.open(blobUrl, '_blank')
      } else {
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = fileName
        a.click()
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
      }

      if (uploadToDrive) {
        toast.success('הגיבוי הורד למכשירך והועלה בהצלחה לתיקיית "גיבויים" ב-Google Drive')
      } else {
        toast.success(`קובץ הגיבוי (${fileName}) הוכן בהצלחה`)
      }
    } catch {
      toast.error('שגיאת תקשורת בעת הפקת הגיבוי')
    } finally {
      setLoadingMode(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs font-bold border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 rounded-xl h-8 px-3"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>גיבוי מלא</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg dir-rtl text-right p-6 rounded-2xl" dir="rtl">
        <DialogHeader className="text-right space-y-1 pb-2 border-b border-slate-100">
          <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Download className="w-5 h-5 text-emerald-600" />
            גיבוי מלא ומסודר של כל נתוני הפורטל
          </DialogTitle>
          <p className="text-xs text-slate-500">
            ייצוא כל הפרויקטים, הקונים, לוחות התשלומים, התנועות בפועל, ההלוואות, השותפים, השכנים והעובדים לקובץ אחד ברור ומסודר.
          </p>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Option 1: Organized Readable HTML / PDF Report */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-900">דוח גיבוי מלא ומסודר לקריאה והדפסה</h4>
                  <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">מומלץ</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  קובץ אחד ברור ומעוצב בעברית הכולל סיכום מנהלים ופירוט מלא לכל פרויקט: כל הקונים ויתרותיהם, לוחות תשלומים מול ביצוע בפועל, הלוואות, שותפים ושכנים.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                onClick={() => downloadBackup('html', false, false)}
                disabled={loadingMode !== null}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 h-9"
              >
                {loadingMode === 'html-local-dl' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                הורד קובץ דוח מסודר (.html)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadBackup('html', false, true)}
                disabled={loadingMode !== null}
                className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-bold text-xs gap-1.5 h-9"
              >
                {loadingMode === 'html-local-tab' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                פתח להדפסה / שמירה כ-PDF
              </Button>
            </div>
          </div>

          {/* Option 2: Excel CSV */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-900">קובץ גיבוי מאורגן לאקסל (CSV בעברית)</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  כל הטבלאות (פרויקטים, קונים, פירוט תשלומי קונים, תשלומי ספקים, הלוואות, שותפים ושכנים) בקובץ אחד מוכן לפתיחה ב-Excel.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadBackup('csv', false, false)}
              disabled={loadingMode !== null}
              className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 font-bold text-xs gap-1.5 h-9"
            >
              {loadingMode === 'csv-local-dl' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              הורד קובץ לאקסל (.csv)
            </Button>
          </div>

          {/* Option 3: Full System JSON + Google Drive */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                <Database className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-900">גיבוי מערכת מלא (JSON + שמירה ב-Google Drive)</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  כולל גם את העץ ההיררכי המסודר וגם את כל 22 טבלאות המסד הגולמיות לשחזור טכני מלא.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadBackup('json', false, false)}
                disabled={loadingMode !== null}
                className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs gap-1.5 h-9"
              >
                {loadingMode === 'json-local-dl' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                הורד גיבוי JSON מלא
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadBackup('json', true, false)}
                disabled={loadingMode !== null}
                className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50 font-bold text-xs gap-1.5 h-9"
              >
                {loadingMode === 'json-drive-dl' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <HardDrive className="w-4 h-4" />
                )}
                גיבוי מלא + העלה ל-Drive
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>כל סוגי הגיבויים כוללים את כל הפרויקטים, הקונים, התשלומים, ההלוואות, השותפים והשכנים בזמן אמת.</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
