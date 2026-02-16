'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, Trash2, Eye } from 'lucide-react'
import { getModuleViews, saveView, deleteView } from '@/lib/actions/views'
import type { CustomView } from '@/lib/actions/views'
import { useToast } from '@/components/ui/toast'

interface ViewManagerProps {
  clientId: string
  moduleName: string
  availableColumns: string[] // Column names
  currentView?: CustomView
  currentConfig?: {
    visible_columns: string[]
    column_order: string[]
    filters: Record<string, any>
    sort_by?: string
    sort_direction?: 'asc' | 'desc'
  }
  onViewChange?: (view: CustomView | null) => void
}

export function ViewManager({
  clientId,
  moduleName,
  availableColumns,
  currentView,
  currentConfig,
  onViewChange,
}: ViewManagerProps) {
  const { showToast } = useToast()
  const [views, setViews] = useState<CustomView[]>([])
  const [loading, setLoading] = useState(true)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [viewName, setViewName] = useState('')

  const loadViews = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getModuleViews(clientId, moduleName)
      if (result.success && result.views) {
        setViews(result.views)
      }
    } catch (error) {
      console.error('Error loading views:', error)
    } finally {
      setLoading(false)
    }
  }, [clientId, moduleName])

  useEffect(() => {
    loadViews()
  }, [loadViews])

  const handleSaveCurrentView = async () => {
    if (!viewName.trim()) {
      showToast('error', 'יש להזין שם לתצוגה')
      return
    }
    const fallbackView = {
      visible_columns: availableColumns,
      column_order: availableColumns,
      filters: {},
      sort_by: undefined,
      sort_direction: undefined,
    }

    try {
      const viewConfig = currentConfig || currentView || fallbackView
      const result = await saveView(clientId, moduleName, viewName.trim(), {
        visible_columns: viewConfig.visible_columns || availableColumns,
        column_order: viewConfig.column_order || availableColumns,
        filters: viewConfig.filters || {},
        sort_by: viewConfig.sort_by,
        sort_direction: viewConfig.sort_direction,
      })

      if (result.success) {
        showToast('success', 'תצוגה נשמרה בהצלחה')
        await loadViews()
        setShowSaveDialog(false)
        setViewName('')
      } else {
        showToast('error', result.error || 'שגיאה בשמירת תצוגה')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    }
  }

  const handleDeleteView = async (viewName: string) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את התצוגה "${viewName}"?`)) {
      return
    }

    try {
      const result = await deleteView(clientId, moduleName, viewName)
      if (result.success) {
        showToast('success', 'תצוגה נמחקה בהצלחה')
        await loadViews()
        if (currentView?.view_name === viewName) {
          onViewChange?.(null)
        }
      } else {
        showToast('error', result.error || 'שגיאה במחיקת תצוגה')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    }
  }

  const handleSelectView = (view: CustomView) => {
    onViewChange?.(view)
    showToast('success', `תצוגה "${view.view_name}" נטענה`)
  }

  if (loading) {
    return (
      <Card className="p-4">
        <div className="text-center py-4">
          <p className="text-grey text-sm">טוען תצוגות...</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">תצוגות שמורות</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSaveDialog(true)}
          className="gap-2"
          disabled={availableColumns.length === 0}
        >
          <Save className="h-4 w-4" />
          שמור תצוגה נוכחית
        </Button>
      </div>

      {views.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-grey text-center">
            אין תצוגות שמורות. שמור תצוגה כדי להתחיל.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {views.map((view) => (
            <Card key={view.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-grey" />
                <span className="font-medium">{view.view_name}</span>
                {currentView?.view_name === view.view_name && (
                  <span className="text-xs bg-emerald/10 text-emerald px-2 py-0.5 rounded">
                    פעילה
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectView(view)}
                  className="gap-2"
                >
                  טען
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteView(view.view_name)}
                  className="gap-2 text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Save View Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>שמור תצוגה</DialogTitle>
            <DialogDescription>
              הזן שם לתצוגה הנוכחית
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>שם תצוגה</Label>
            <Input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="לדוגמה: תצוגה שלי"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              ביטול
            </Button>
            <Button onClick={handleSaveCurrentView} disabled={!viewName.trim()}>
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

