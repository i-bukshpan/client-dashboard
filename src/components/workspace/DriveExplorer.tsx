'use client'

/**
 * src/components/workspace/DriveExplorer.tsx
 *
 * DriveExplorer — lists files and subfolders in a client's Google Drive folder.
 * Features:
 * - Real-time folder & file exploration with recursive folder drill-down
 * - Breadcrumbs navigation & "Back" button for subfolders
 * - Direct "Set as Main Sheet" (הגדר כגיליון ראשי) button for Google Sheets files
 * - Direct File Upload & Drag-and-Drop dropzone to the currently open folder
 * - External link to open any folder/file directly in Google Drive
 */

import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FolderOpen,
  Folder,
  RefreshCw,
  ExternalLink,
  FileText,
  Sheet as SheetIcon,
  FileImage,
  File,
  AlertCircle,
  ChevronLeft,
  ArrowRight,
  CheckCircle2,
  Table as TableIcon,
  Loader2,
  UploadCloud,
  Upload,
} from 'lucide-react'
import type { ClientDriveFile as DriveFile } from '@/lib/workspace-utils'
import { formatFileSize } from '@/lib/workspace-utils'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { linkSheetAction, uploadFileToDriveAction } from '@/app/admin/crm/[id]/actions-workspace'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface DriveExplorerProps {
  clientId: string
  folderId: string | null
  folderName: string
  currentSheetId?: string | null
}

interface BreadcrumbItem {
  id: string
  name: string
}

function FileIcon({ mimeType, isFolder }: { mimeType: string; isFolder?: boolean }) {
  const cls = 'w-8 h-8 p-1.5 rounded-xl shrink-0'
  if (isFolder || mimeType === 'application/vnd.google-apps.folder')
    return <div className={`${cls} bg-amber-100 text-amber-600`}><Folder className="w-full h-full" /></div>
  if (mimeType.includes('pdf'))
    return <div className={`${cls} bg-red-100 text-red-600`}><FileText className="w-full h-full" /></div>
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('google-apps.spreadsheet'))
    return <div className={`${cls} bg-emerald-100 text-emerald-600`}><SheetIcon className="w-full h-full" /></div>
  if (mimeType.includes('word') || mimeType.includes('document'))
    return <div className={`${cls} bg-blue-100 text-blue-600`}><FileText className="w-full h-full" /></div>
  if (mimeType.includes('image'))
    return <div className={`${cls} bg-purple-100 text-purple-600`}><FileImage className="w-full h-full" /></div>
  return <div className={`${cls} bg-slate-100 text-slate-500`}><File className="w-full h-full" /></div>
}

function MimeLabel({ mimeType, isFolder }: { mimeType: string; isFolder?: boolean }) {
  if (isFolder || mimeType === 'application/vnd.google-apps.folder')
    return <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">תיקייה</Badge>
  if (mimeType.includes('pdf'))
    return <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50">PDF</Badge>
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('google-apps.spreadsheet'))
    return <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50">Sheet</Badge>
  if (mimeType.includes('word') || mimeType.includes('document'))
    return <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 bg-blue-50">Doc</Badge>
  if (mimeType.includes('image'))
    return <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-200 bg-purple-50">תמונה</Badge>
  return <Badge variant="outline" className="text-[10px]">קובץ</Badge>
}

function FileSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
      <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-4 w-10 rounded" />
    </div>
  )
}

export function DriveExplorer({
  clientId,
  folderId,
  folderName,
  currentSheetId,
}: DriveExplorerProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [folderStack, setFolderStack] = useState<BreadcrumbItem[]>(
    folderId ? [{ id: folderId, name: folderName }] : []
  )
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const currentFolder = folderStack[folderStack.length - 1]
  const isSubfolder = folderStack.length > 1

  const fetchFiles = useCallback(async (targetFolderId: string) => {
    if (!targetFolderId) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ clientId, folderId: targetFolderId })
      const res = await fetch(`/api/workspace/drive-files?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'שגיאה בטעינת קבצים')
      setFiles(json.files)
      setLastRefreshed(new Date())
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'שגיאה בטעינת קבצים')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    if (!currentFolder?.id) return
    const timer = window.setTimeout(() => void fetchFiles(currentFolder.id), 0)
    return () => window.clearTimeout(timer)
  }, [currentFolder?.id, fetchFiles])

  // Drill down into subfolder
  const handleOpenFolder = (folder: DriveFile) => {
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }])
  }

  // Navigate back to specific folder index in stack
  const handleNavigateToBreadcrumb = (index: number) => {
    setFolderStack((prev) => prev.slice(0, index + 1))
  }

  // Step back one folder
  const handleBack = () => {
    if (folderStack.length > 1) {
      setFolderStack((prev) => prev.slice(0, prev.length - 1))
    }
  }

  // Link a sheet file as the main spreadsheet
  const handleLinkSheet = (sheetFile: DriveFile) => {
    setLinkingId(sheetFile.id)
    startTransition(async () => {
      try {
        const res = await linkSheetAction(clientId, sheetFile.id)
        if ('error' in res) {
          toast.error(res.error)
        } else {
          toast.success(`הגיליון "${sheetFile.name}" הוגדר כגיליון הראשי בהצלחה!`)
          router.refresh()
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'שגיאה בחיבור הגיליון')
      } finally {
        setLinkingId(null)
      }
    })
  }

  // File Upload Handlers
  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !currentFolder?.id) return

    setUploading(true)
    let uploadedCount = 0

    const toastId = toast.loading(`מעלה ${fileList.length} קבצים ל-Drive...`)

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await uploadFileToDriveAction(clientId, currentFolder.id, formData)
        if ('error' in res) {
          toast.error(`שגיאה בהעלאת ${file.name}: ${res.error}`)
        } else {
          uploadedCount++
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'שגיאה לא ידועה'
        toast.error(`שגיאה בהעלאת ${file.name}: ${message}`)
      }
    }

    setUploading(false)
    toast.dismiss(toastId)

    if (uploadedCount > 0) {
      toast.success(
        uploadedCount === 1
          ? 'הקובץ הועלה בהצלחה ל-Drive!'
          : `${uploadedCount} קבצים הועלו בהצלחה!`
      )
      // Refresh current folder file list
      fetchFiles(currentFolder.id)
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files)
    }
  }

  const driveUrl = currentFolder?.id
    ? `https://drive.google.com/drive/folders/${currentFolder.id}`
    : null

  return (
    <Card
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-border/50 shadow-sm overflow-hidden h-full flex flex-col relative transition-all duration-200 ${
        isDragging ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''
      }`}
    >
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleUploadFiles(e.target.files)}
        multiple
        className="hidden"
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-indigo-600/10 backdrop-blur-xs border-2 border-dashed border-indigo-500 rounded-xl flex flex-col items-center justify-center pointer-events-none">
          <div className="p-4 rounded-2xl bg-white shadow-xl flex flex-col items-center">
            <UploadCloud className="w-10 h-10 text-indigo-600 animate-bounce mb-2" />
            <p className="font-bold text-sm text-foreground">שחרר קבצים כאן להעלאה</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              הקבצים יועלו לתיקייה &quot;{currentFolder?.name}&quot;
            </p>
          </div>
        </div>
      )}

      {/* Header bar */}
      <CardHeader className="border-b border-border/50 bg-slate-50/50 py-3 px-5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-foreground">Google Drive</CardTitle>
              {lastRefreshed && (
                <p className="text-[10px] text-muted-foreground">
                  עודכן {format(lastRefreshed, 'HH:mm:ss')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Upload Button */}
            {folderId && (
              <Button
                size="sm"
                variant="default"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || loading}
                className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 font-semibold shadow-xs"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {uploading ? 'מעלה...' : 'העלה קובץ'}
              </Button>
            )}

            {driveUrl && (
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                פתח ב-Drive
              </a>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => currentFolder?.id && fetchFiles(currentFolder.id)}
              disabled={loading || uploading}
              className="h-8 w-8 p-0"
              title="רענן רשימת קבצים"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Breadcrumbs navigation */}
        {isSubfolder && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/40 text-xs overflow-x-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="w-3 h-3" />
              חזור
            </Button>

            <span className="text-muted-foreground/40">|</span>

            {folderStack.map((item, idx) => {
              const isLast = idx === folderStack.length - 1
              return (
                <div key={item.id} className="flex items-center gap-1 whitespace-nowrap">
                  {idx > 0 && <ChevronLeft className="w-3 h-3 text-muted-foreground/40" />}
                  <button
                    type="button"
                    onClick={() => handleNavigateToBreadcrumb(idx)}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      isLast
                        ? 'font-bold text-foreground bg-muted/70 cursor-default'
                        : 'text-muted-foreground hover:text-foreground hover:underline'
                    }`}
                  >
                    {item.name}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 flex-1 overflow-y-auto">
        {/* No folder configured */}
        {!folderId && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <FolderOpen className="w-7 h-7 text-slate-400" />
            </div>
            <p className="font-semibold text-foreground text-sm">אין תיקיית Drive מוגדרת</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              לחץ על &quot;ערוך פרטי לקוח&quot; והדבק קישור או מזהה תיקייה מגוגל דרייב
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <FileSkeleton key={i} />)}
          </div>
        )}

        {/* Empty folder */}
        {!loading && !error && folderId && files.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6 text-indigo-500" />
            </div>
            <p className="font-semibold text-foreground text-sm">התיקייה ריקה</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              גרור ושחרר קבצים לכאן או לחץ על כפתור ההעלאה
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 text-xs font-semibold"
            >
              <Upload className="w-3.5 h-3.5" />
              בחר קבצים להעלאה
            </Button>
          </div>
        )}

        {/* Items list (folders & files) */}
        {!loading && !error && files.length > 0 && (
          <div className="space-y-1.5">
            {files.map((file) => {
              const isFolder = file.isFolder || file.mimeType === 'application/vnd.google-apps.folder'
              const isSpreadsheet =
                file.mimeType === 'application/vnd.google-apps.spreadsheet' ||
                file.mimeType.includes('spreadsheet') ||
                file.name.endsWith('.xlsx') ||
                file.name.endsWith('.csv')
              const isCurrentMainSheet = currentSheetId === file.id
              const isLinkingThis = linkingId === file.id

              if (isFolder) {
                return (
                  <div
                    key={file.id}
                    onClick={() => handleOpenFolder(file)}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-amber-200 hover:bg-amber-50/50 transition-all group cursor-pointer"
                  >
                    <FileIcon mimeType={file.mimeType} isFolder />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground truncate group-hover:text-amber-700 transition-colors">
                          {file.name}
                        </p>
                        <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-300 bg-amber-50 px-1 py-0">
                          תיקייה
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        עודכן {format(new Date(file.modifiedTime), 'd MMM yyyy', { locale: he })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>פתח</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-border/70 hover:bg-slate-50 transition-all group"
                >
                  <FileIcon mimeType={file.mimeType} />

                  <div className="flex-1 min-w-0">
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-foreground truncate hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      <span className="truncate">{file.name}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-muted-foreground/60 transition-opacity shrink-0" />
                    </a>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(file.modifiedTime), 'd MMM yyyy', { locale: he })}
                      </span>
                      {file.size && (
                        <>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* If this is a spreadsheet */}
                    {isSpreadsheet && (
                      <>
                        {isCurrentMainSheet ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1 text-[10px] font-bold shadow-none hover:bg-emerald-100">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            גיליון ראשי
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleLinkSheet(file)
                            }}
                            disabled={isLinkingThis || isPending}
                            className="h-6 px-2 text-[10px] gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-bold"
                          >
                            {isLinkingThis ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <TableIcon className="w-2.5 h-2.5" />
                            )}
                            הגדר כגיליון ראשי
                          </Button>
                        )}
                      </>
                    )}

                    <MimeLabel mimeType={file.mimeType} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Footer summary */}
      {files.length > 0 && (
        <div className="px-5 py-2.5 border-t border-border/50 bg-slate-50/50 shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            {files.length} פריטים בתיקייה
          </p>
          {driveUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              פתח ב-Drive
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      )}
    </Card>
  )
}
