'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getClientFiles, formatFileSize, getMimeIcon, getFolderLink } from '@/lib/google-drive'
import type { DriveFile } from '@/lib/google-drive'
import { FolderOpen, ExternalLink, RefreshCw, Upload, File } from 'lucide-react'

interface Props {
  folderId: string | null
  clientName: string
}

export function ClientDocuments({ folderId, clientName }: Props) {
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)

  async function loadFiles() {
    if (!folderId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await getClientFiles(folderId)
      setFiles(data)
    } catch (error) {
      console.error('Error loading files:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles()
  }, [folderId])

  if (!folderId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">לא קושרה תיקיית Drive ללקוח זה</p>
          <Button variant="outline" className="mt-4 gap-2">
            צור תיקייה עכשיו
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-primary" />
          קבצי לקוח ב-Google Drive
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1 h-8" onClick={loadFiles}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            רענן
          </Button>
          <Button size="sm" className="gap-1 h-8" asChild>
            <a href={getFolderLink(folderId)} target="_blank" rel="noreferrer">
              <ExternalLink className="w-3.5 h-3.5" />
              פתח ב-Drive
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-xl">
            <p className="text-muted-foreground text-sm">התיקייה ריקה</p>
            <Button variant="ghost" size="sm" className="mt-2 gap-1">
              <Upload className="w-3.5 h-3.5" />
              העלה קובץ ראשון
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors group"
              >
                <div className="text-2xl w-10 h-10 flex items-center justify-center bg-muted rounded-lg shrink-0">
                  {getMimeIcon(file.mimeType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)} • עודכן לאחרונה: {new Date(file.modifiedTime).toLocaleDateString('he-IL')}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                  <a href={file.webViewLink} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
