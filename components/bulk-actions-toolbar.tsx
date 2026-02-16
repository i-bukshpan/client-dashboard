'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, Tag, FileDown, MoreHorizontal, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { bulkUpdateClientStatus, bulkDeleteClients } from '@/lib/actions/bulk-operations'
import { bulkAssignTags, getAllTags } from '@/lib/actions/tags'
import type { ClientTag } from '@/lib/actions/tags'
import { useToast } from '@/components/ui/toast'

interface BulkActionsToolbarProps {
  selectedClientIds: string[]
  onActionComplete: () => void
  onClearSelection: () => void
}

export function BulkActionsToolbar({ selectedClientIds, onActionComplete, onClearSelection }: BulkActionsToolbarProps) {
  const { showToast } = useToast()
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [showTagsDialog, setShowTagsDialog] = useState(false)
  const [newStatus, setNewStatus] = useState('פעיל')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<ClientTag[]>([])
  const [loading, setLoading] = useState(false)

  const loadTags = async () => {
    const result = await getAllTags()
    if (result.success && result.tags) {
      setAvailableTags(result.tags)
    }
  }

  const handleUpdateStatus = async () => {
    setLoading(true)
    try {
      const result = await bulkUpdateClientStatus(selectedClientIds, newStatus)
      if (result.success) {
        showToast('success', `סטטוס עודכן ל-${newStatus} עבור ${result.updated || 0} לקוחות`)
        setShowStatusDialog(false)
        onActionComplete()
        onClearSelection()
      } else {
        showToast('error', result.error || 'שגיאה בעדכון סטטוס')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  const handleAssignTags = async () => {
    if (selectedTagIds.length === 0) {
      showToast('error', 'יש לבחור לפחות תגית אחת')
      return
    }
    setLoading(true)
    try {
      const result = await bulkAssignTags(selectedClientIds, selectedTagIds)
      if (result.success) {
        showToast('success', `תגיות הוקצו ל-${selectedClientIds.length} לקוחות`)
        setShowTagsDialog(false)
        setSelectedTagIds([])
        onActionComplete()
        onClearSelection()
      } else {
        showToast('error', result.error || 'שגיאה בהקצאת תגיות')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק ${selectedClientIds.length} לקוחות? פעולה זו לא ניתנת לביטול.`)) {
      return
    }

    setLoading(true)
    try {
      const result = await bulkDeleteClients(selectedClientIds)
      if (result.success) {
        showToast('success', `${result.deleted || 0} לקוחות נמחקו`)
        onActionComplete()
        onClearSelection()
      } else {
        showToast('error', result.error || 'שגיאה במחיקה')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    // This will be handled by the parent component
    showToast('info', 'ייצוא נתונים - יתווסף בקרוב')
  }

  if (selectedClientIds.length === 0) {
    return null
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between" dir="rtl">
      <div className="flex items-center gap-4">
        <span className="font-medium text-blue-900">
          נבחרו {selectedClientIds.length} לקוחות
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          ביטול בחירה
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowStatusDialog(true)
          }}
          className="gap-2"
        >
          עדכן סטטוס
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadTags()
            setShowTagsDialog(true)
          }}
          className="gap-2"
        >
          <Tag className="h-4 w-4" />
          הוסף תגיות
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          className="gap-2"
        >
          <FileDown className="h-4 w-4" />
          ייצא
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          className="gap-2 text-red-600 hover:text-red-700"
          disabled={loading}
        >
          <Trash2 className="h-4 w-4" />
          מחק
        </Button>
      </div>

      {/* Update Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>עדכן סטטוס</DialogTitle>
            <DialogDescription>
              בחר סטטוס חדש עבור {selectedClientIds.length} לקוחות
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>סטטוס חדש</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="פעיל">פעיל</SelectItem>
                <SelectItem value="ליד">ליד</SelectItem>
                <SelectItem value="ארכיון">ארכיון</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              ביטול
            </Button>
            <Button onClick={handleUpdateStatus} disabled={loading}>
              {loading ? 'מעדכן...' : 'עדכן'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Tags Dialog */}
      <Dialog open={showTagsDialog} onOpenChange={setShowTagsDialog}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>הוסף תגיות</DialogTitle>
            <DialogDescription>
              בחר תגיות להוספה ל-{selectedClientIds.length} לקוחות
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-60 overflow-y-auto">
            {availableTags.length === 0 ? (
              <p className="text-sm text-grey text-center py-4">אין תגיות זמינות</p>
            ) : (
              <div className="space-y-2">
                {availableTags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-2 p-2 hover:bg-grey/10 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(tag.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTagIds([...selectedTagIds, tag.id])
                        } else {
                          setSelectedTagIds(selectedTagIds.filter(id => id !== tag.id))
                        }
                      }}
                      className="h-4 w-4"
                    />
                    <span
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span>{tag.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowTagsDialog(false)
              setSelectedTagIds([])
            }}>
              ביטול
            </Button>
            <Button onClick={handleAssignTags} disabled={loading || selectedTagIds.length === 0}>
              {loading ? 'מקצה...' : 'הקצה תגיות'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

