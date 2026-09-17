'use client'

import React, { useState } from 'react'
import {
  TableIcon,
  FolderOpen,
  ExternalLink,
  Plus,
  Trash2,
  Layers,
  FileSpreadsheet,
  Building,
  Receipt,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { ClientAsset, ClientAssetType, ClientAssetCategory } from '@/lib/v2/client-ecosystem-dal'
import { addClientAssetAction, deleteClientAssetAction } from '@/app/workspace/actions/client-ecosystem'

interface ClientAssetsManagerProps {
  clientId: string
  clientName: string
  initialAssets: ClientAsset[]
  defaultSheetId?: string | null
  defaultDriveFolderId?: string | null
  onSelectSheet?: (sheetId: string) => void
}

const CATEGORY_CONFIG: Record<ClientAssetCategory, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  general: { label: 'כללי', icon: Layers },
  cash_flow: { label: 'תזרים מזומנים', icon: FileSpreadsheet },
  invoices: { label: 'חשבוניות וקבלות', icon: Receipt },
  project_taboo: { label: 'פרויקט טאבו משותף', icon: Building },
  tama38: { label: 'תמ"א 38 / התחדשות', icon: Building },
  tax_cpa: { label: 'רואה חשבון / מיסים', icon: FileText },
  contracts: { label: 'חוזים ומסמכים', icon: FileText },
}

export function ClientAssetsManager({
  clientId,
  clientName,
  initialAssets = [],
  defaultSheetId,
  defaultDriveFolderId,
  onSelectSheet,
}: ClientAssetsManagerProps) {
  const [assets, setAssets] = useState<ClientAsset[]>(initialAssets)
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [assetType, setAssetType] = useState<ClientAssetType>('sheet')
  const [name, setName] = useState('')
  const [assetIdOrUrl, setAssetIdOrUrl] = useState('')
  const [category, setCategory] = useState<ClientAssetCategory>('cash_flow')
  const [isPrimary, setIsPrimary] = useState(false)
  const [notes, setNotes] = useState('')

  const sheetsList = assets.filter((a) => a.assetType === 'sheet')
  const driveList = assets.filter((a) => a.assetType === 'drive_folder')

  const handleAddAsset = async () => {
    if (!name.trim() || !assetIdOrUrl.trim()) {
      toast.error('נא להזין שם ומזהה/קישור תקין')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await addClientAssetAction({
        clientId,
        assetType,
        assetId: assetIdOrUrl.trim(),
        name: name.trim(),
        category,
        isPrimary,
        notes: notes.trim() || undefined,
      })

      if (res.success && res.asset) {
        setAssets((prev) => [res.asset!, ...prev])
        toast.success(`נכס "${name}" נוסף בהצלחה`)
        setIsOpen(false)
        setName('')
        setAssetIdOrUrl('')
        setNotes('')
      } else {
        toast.error(res.error || 'הוספת הנכס נכשלה')
      }
    } catch (err: any) {
      toast.error(err.message || 'שגיאה לא צפויה')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteAsset = async (id: string, assetName: string) => {
    if (!confirm(`האם להסיר את הקישור ל-${assetName}? (הקובץ המקורי ב-Google לא יימחק)`)) return

    try {
      const res = await deleteClientAssetAction(id, clientId)
      if (res.success) {
        setAssets((prev) => prev.filter((a) => a.id !== id))
        toast.success('הנכס הוסר בהצלחה')
      } else {
        toast.error(res.error || 'שגיאה בהסרת הנכס')
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card/60 p-4 rounded-xl border border-border">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            נכסים דיגיטליים וקבצי עבודה ({clientName})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            ניהול מספר גיליונות תזרים, פרויקטים ותיקיות Drive במקום אחד
          </p>
        </div>
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 gap-1.5"
        >
          <Plus className="w-4 h-4" />
          קשר גיליון או תיקייה
        </Button>
      </div>

      {/* Grid of Sections: Sheets & Drive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── 1. Google Sheets Section ──────────────────────────── */}
        <Card className="border-border bg-card/40 backdrop-blur-xs">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-emerald-500" />
                גיליונות Google Sheets ({sheetsList.length + (defaultSheetId ? 1 : 0)})
              </span>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                נתונים ודשבורדים
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {/* Fallback default sheet if not in assets table */}
            {defaultSheetId && !sheetsList.some((s) => s.assetId === defaultSheetId) && (
              <div className="p-3 rounded-lg border border-border/70 bg-card flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-500 shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground truncate">גיליון ראשי מחובר</span>
                      <Badge className="text-[10px] h-4 px-1.5 bg-indigo-500/20 text-indigo-300">ראשי</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono truncate block" dir="ltr">
                      ID: {defaultSheetId.slice(0, 16)}...
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onSelectSheet && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-indigo-400 hover:text-indigo-300"
                      onClick={() => onSelectSheet(defaultSheetId)}
                    >
                      הצג
                    </Button>
                  )}
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${defaultSheetId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="פתח ב-Google Sheets"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {sheetsList.map((sheet) => {
              const CatIcon = CATEGORY_CONFIG[sheet.category]?.icon || FileSpreadsheet
              return (
                <div
                  key={sheet.id}
                  className="p-3 rounded-lg border border-border/70 bg-card hover:border-border transition-colors flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-500 shrink-0">
                      <CatIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">{sheet.name}</span>
                        {sheet.isPrimary && (
                          <Badge className="text-[10px] h-4 px-1.5 bg-indigo-500/20 text-indigo-300">ראשי</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                          {CATEGORY_CONFIG[sheet.category]?.label || sheet.category}
                        </Badge>
                      </div>
                      {sheet.notes && (
                        <p className="text-xs text-muted-foreground truncate">{sheet.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {onSelectSheet && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-indigo-400 hover:text-indigo-300"
                        onClick={() => onSelectSheet(sheet.assetId)}
                      >
                        הצג
                      </Button>
                    )}
                    <a
                      href={sheet.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="פתח ב-Google Sheets"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      onClick={() => handleDeleteAsset(sheet.id, sheet.name)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}

            {sheetsList.length === 0 && !defaultSheetId && (
              <p className="text-xs text-muted-foreground text-center py-6">
                טרם קושרו גיליונות Google Sheets ללקוח זה.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── 2. Google Drive Folders Section ────────────────────── */}
        <Card className="border-border bg-card/40 backdrop-blur-xs">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-500" />
                תיקיות Google Drive ({driveList.length + (defaultDriveFolderId ? 1 : 0)})
              </span>
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                מסמכים וחשבוניות
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {/* Fallback default Drive folder if not in assets */}
            {defaultDriveFolderId && !driveList.some((d) => d.assetId === defaultDriveFolderId) && (
              <div className="p-3 rounded-lg border border-border/70 bg-card flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-md bg-amber-500/10 text-amber-500 shrink-0">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground truncate">תיקיית Drive ראשית</span>
                      <Badge className="text-[10px] h-4 px-1.5 bg-indigo-500/20 text-indigo-300">ראשית</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono truncate block" dir="ltr">
                      ID: {defaultDriveFolderId.slice(0, 16)}...
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={`https://drive.google.com/drive/folders/${defaultDriveFolderId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="פתח ב-Google Drive"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {driveList.map((folder) => {
              const CatIcon = CATEGORY_CONFIG[folder.category]?.icon || FolderOpen
              return (
                <div
                  key={folder.id}
                  className="p-3 rounded-lg border border-border/70 bg-card hover:border-border transition-colors flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-md bg-amber-500/10 text-amber-500 shrink-0">
                      <CatIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">{folder.name}</span>
                        {folder.isPrimary && (
                          <Badge className="text-[10px] h-4 px-1.5 bg-indigo-500/20 text-indigo-300">ראשית</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                          {CATEGORY_CONFIG[folder.category]?.label || folder.category}
                        </Badge>
                      </div>
                      {folder.notes && (
                        <p className="text-xs text-muted-foreground truncate">{folder.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={folder.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="פתח ב-Google Drive"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      onClick={() => handleDeleteAsset(folder.id, folder.name)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}

            {driveList.length === 0 && !defaultDriveFolderId && (
              <p className="text-xs text-muted-foreground text-center py-6">
                טרם קושרו תיקיות Drive ללקוח זה.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Asset Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>קישור נכס חדש (גיליון או תיקיית Drive)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>סוג הנכס</Label>
                <Select value={assetType} onValueChange={(val: any) => setAssetType(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="sheet">Google Sheets (גיליון)</SelectItem>
                    <SelectItem value="drive_folder">Google Drive (תיקייה)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>קטגוריה / תחום</Label>
                <Select value={category} onValueChange={(val: any) => setCategory(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="cash_flow">תזרים מזומנים</SelectItem>
                    <SelectItem value="invoices">חשבוניות וקבלות</SelectItem>
                    <SelectItem value="project_taboo">פרויקט טאבו משותף</SelectItem>
                    <SelectItem value="tama38">{"תמ\"א 38 / התחדשות"}</SelectItem>
                    <SelectItem value="tax_cpa">{"רו\"ח ומיסים"}</SelectItem>
                    <SelectItem value="contracts">חוזים ומסמכים</SelectItem>
                    <SelectItem value="general">כללי</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>שם מזהה לנכס</Label>
              <Input
                placeholder="למשל: תזרים פרויקט לינקנט / חשבוניות ספקים 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>קישור מלא (URL) או מזהה (ID)</Label>
              <Input
                placeholder="הדבק קישור ישיר מ-Google Sheets או Drive"
                dir="ltr"
                value={assetIdOrUrl}
                onChange={(e) => setAssetIdOrUrl(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                המערכת תחלץ אוטומטית את ה-ID מתוך כתובת ה-URL שתודבק.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>הערות (אופציונלי)</Label>
              <Input
                placeholder="למשל: כולל לשוניות ספקים ועובדים מעודכן ל-2026"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isPrimaryAsset"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="rounded border-border"
              />
              <Label htmlFor="isPrimaryAsset" className="text-xs cursor-pointer">
                הגדר כנכס ברירת מחדל מרכזי ללקוח זה
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
              ביטול
            </Button>
            <Button
              onClick={handleAddAsset}
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSubmitting ? 'שומר...' : 'קשר נכס'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
