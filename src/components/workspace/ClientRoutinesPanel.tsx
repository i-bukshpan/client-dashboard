'use client'

import React, { useState } from 'react'
import {
  CalendarClock,
  Plus,
  Trash2,
  Play,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import type { ClientRoutine, RoutineFrequency, RoutineAssignedRole } from '@/lib/v2/client-ecosystem-dal'
import {
  saveClientRoutineAction,
  toggleClientRoutineAction,
  deleteClientRoutineAction,
} from '@/app/workspace/actions/client-ecosystem'

interface ClientRoutinesPanelProps {
  clientId: string
  clientName: string
  initialRoutines: ClientRoutine[]
  onTriggerTask?: (routine: ClientRoutine) => void
}

const ROLE_LABELS: Record<RoutineAssignedRole, { label: string; color: string }> = {
  nehemiah: { label: 'נחמיה', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  secretary: { label: 'מזכירה', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  cpa: { label: 'רואה חשבון', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  client: { label: 'לקוח', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
}

const FREQ_LABELS: Record<RoutineFrequency, string> = {
  daily: 'יומי',
  weekly: 'שבועי',
  monthly: 'חודשי',
  quarterly: 'רבעוני',
}

export function ClientRoutinesPanel({
  clientId,
  clientName,
  initialRoutines = [],
  onTriggerTask,
}: ClientRoutinesPanelProps) {
  const [routines, setRoutines] = useState<ClientRoutine[]>(initialRoutines)
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState<number>(1)
  const [frequency, setFrequency] = useState<RoutineFrequency>('monthly')
  const [assignedRole, setAssignedRole] = useState<RoutineAssignedRole>('nehemiah')

  const handleSaveRoutine = async () => {
    if (!title.trim()) {
      toast.error('נא להזין כותרת לשגרה')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await saveClientRoutineAction({
        clientId,
        title: title.trim(),
        description: description.trim() || undefined,
        dayOfMonth,
        frequency,
        assignedRole,
      })

      if (res.success && res.routine) {
        setRoutines((prev) => [...prev, res.routine!].sort((a, b) => a.dayOfMonth - b.dayOfMonth))
        toast.success(`שגרה "${title}" נוספה בהצלחה`)
        setIsOpen(false)
        setTitle('')
        setDescription('')
        setDayOfMonth(1)
      } else {
        toast.error(res.error || 'שמירת השגרה נכשלה')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggle = async (routine: ClientRoutine) => {
    const nextState = !routine.isActive
    try {
      await toggleClientRoutineAction(routine.id, clientId, nextState)
      setRoutines((prev) =>
        prev.map((r) => (r.id === routine.id ? { ...r, isActive: nextState } : r))
      )
      toast.success(nextState ? 'השגרה הופעלה' : 'השגרה הושהתה')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (id: string, routineTitle: string) => {
    if (!confirm(`האם למחוק את השגרה "${routineTitle}"?`)) return

    try {
      const res = await deleteClientRoutineAction(id, clientId)
      if (res.success) {
        setRoutines((prev) => prev.filter((r) => r.id !== id))
        toast.success('השגרה נמחקה בהצלחה')
      } else {
        toast.error(res.error || 'שגיאה במחיקת שגרה')
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
            <CalendarClock className="w-5 h-5 text-indigo-400" />
            לוח שגרות ומחזוריות חודשית ({clientName})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            משימות קבועות ואירועי בקרה (ה-1 לחודש, ה-5 לחודש, ישיבות רו&quot;ח ומעקב יומי)
          </p>
        </div>
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 gap-1.5"
        >
          <Plus className="w-4 h-4" />
          הוסף שגרה קבועה
        </Button>
      </div>

      {/* Routine Timeline / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {routines.map((routine) => {
          const roleConfig = ROLE_LABELS[routine.assignedRole] || ROLE_LABELS.nehemiah

          return (
            <Card
              key={routine.id}
              className={`border transition-all ${
                routine.isActive
                  ? 'border-border/80 bg-card/50 shadow-xs'
                  : 'border-border/40 bg-card/20 opacity-60'
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex flex-col items-center justify-center font-bold text-xs leading-none shrink-0">
                      <span className="text-[10px] text-muted-foreground font-normal">יום</span>
                      <span>{routine.dayOfMonth}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground leading-tight">
                        {routine.title}
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        {FREQ_LABELS[routine.frequency]} • כל {routine.dayOfMonth} לחודש
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${roleConfig.color}`}>
                    {roleConfig.label}
                  </Badge>
                </div>

                {routine.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {routine.description}
                  </p>
                )}

                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleToggle(routine)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        routine.isActive ? 'bg-emerald-400' : 'bg-muted-foreground/40'
                      }`}
                    />
                    {routine.isActive ? 'פעיל' : 'מושהה'}
                  </button>

                  <div className="flex items-center gap-1">
                    {onTriggerTask && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-indigo-400 hover:text-indigo-300 gap-1 px-2"
                        onClick={() => onTriggerTask(routine)}
                        title="הפעל משימה זו כעת"
                      >
                        <Play className="w-3 h-3" />
                        הפעל
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-400"
                      onClick={() => handleDelete(routine.id, routine.title)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {routines.length === 0 && (
          <div className="col-span-full text-center py-10 bg-card/20 rounded-xl border border-dashed border-border p-6">
            <CalendarClock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">אין עדיין שגרות קבועות ללקוח זה</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              הגדר שגרות חודשיות כמו סקירת חשבונות ב-1 לחודש, הפקת חשבוניות ב-5 לחודש או בדיקת חשבוניות מול המזכירה.
            </p>
          </div>
        )}
      </div>

      {/* Add Routine Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[440px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>הגדרת שגרה חודשית חדשה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label>כותרת השגרה</Label>
              <Input
                placeholder="למשל: סקירת חשבונות חודשית / הפקת חשבוניות / ישיבה עם רו&quot;ח"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>יום בחודש (1-31)</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>מחזוריות</Label>
                <Select value={frequency} onValueChange={(val: any) => setFrequency(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="monthly">חודשי</SelectItem>
                    <SelectItem value="daily">יומי</SelectItem>
                    <SelectItem value="weekly">שבועי</SelectItem>
                    <SelectItem value="quarterly">רבעוני</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>גורם אחראי</Label>
              <Select value={assignedRole} onValueChange={(val: any) => setAssignedRole(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="nehemiah">נחמיה (יועץ)</SelectItem>
                  <SelectItem value="secretary">מזכירת הלקוח</SelectItem>
                  <SelectItem value="cpa">רואה חשבון</SelectItem>
                  <SelectItem value="client">הלקוח עצמו</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>הנחיות ודגשים לשגרה (אופציונלי)</Label>
              <Input
                placeholder="למשל: לוודא שכל החשבוניות מתויקות בדרייב לפני הישיבה"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
              ביטול
            </Button>
            <Button
              onClick={handleSaveRoutine}
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSubmitting ? 'שומר...' : 'שמור שגרה'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
