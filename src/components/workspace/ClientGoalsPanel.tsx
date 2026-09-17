'use client'

import React, { useState } from 'react'
import {
  TrendingUp,
  Target,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Award,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
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
import type { ClientGoal, GoalStatus } from '@/lib/v2/client-ecosystem-dal'
import { saveClientGoalAction, deleteClientGoalAction } from '@/app/workspace/actions/client-ecosystem'

interface ClientGoalsPanelProps {
  clientId: string
  clientName: string
  initialGoals: ClientGoal[]
}

const STATUS_CONFIG: Record<GoalStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  on_track: { label: 'בקצב היעד', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  behind: { label: 'דורש התערבות', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: AlertCircle },
  achieved: { label: 'הושג בהצלחה', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: Award },
  paused: { label: 'מוקפא', color: 'bg-muted/40 text-muted-foreground border-border', icon: Target },
}

export function ClientGoalsPanel({
  clientId,
  clientName,
  initialGoals = [],
}: ClientGoalsPanelProps) {
  const [goals, setGoals] = useState<ClientGoal[]>(initialGoals)
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetValue, setTargetValue] = useState<string>('')
  const [currentValue, setCurrentValue] = useState<string>('')
  const [unit, setUnit] = useState('₪')
  const [targetDate, setTargetDate] = useState('')
  const [status, setStatus] = useState<GoalStatus>('on_track')

  const handleSaveGoal = async () => {
    if (!title.trim()) {
      toast.error('נא להזין כותרת ליעד')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await saveClientGoalAction({
        clientId,
        title: title.trim(),
        description: description.trim() || undefined,
        targetValue: targetValue ? Number(targetValue) : null,
        currentValue: currentValue ? Number(currentValue) : null,
        unit,
        targetDate: targetDate || null,
        status,
      })

      if (res.success && res.goal) {
        setGoals((prev) => [res.goal!, ...prev])
        toast.success(`היעד "${title}" נוסף בהצלחה`)
        setIsOpen(false)
        setTitle('')
        setDescription('')
        setTargetValue('')
        setCurrentValue('')
        setTargetDate('')
      } else {
        toast.error(res.error || 'שמירת היעד נכשלה')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteGoal = async (id: string, goalTitle: string) => {
    if (!confirm(`האם למחוק את היעד "${goalTitle}"?`)) return

    try {
      const res = await deleteClientGoalAction(id, clientId)
      if (res.success) {
        setGoals((prev) => prev.filter((g) => g.id !== id))
        toast.success('היעד נמחק בהצלחה')
      } else {
        toast.error(res.error || 'שגיאה במחיקת יעד')
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
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            יעדי צמיחה ומדדי הצלחה ({clientName})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            הגדרת יעדים עסקיים, אבני דרך ומעקב התקדמות כמותי
          </p>
        </div>
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 gap-1.5"
        >
          <Plus className="w-4 h-4" />
          הגדר יעד צמיחה
        </Button>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {goals.map((goal) => {
          const statusConfig = STATUS_CONFIG[goal.status] || STATUS_CONFIG.on_track
          const StatusIcon = statusConfig.icon

          return (
            <Card key={goal.id} className="border-border bg-card/50 backdrop-blur-xs">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <h4 className="text-base font-semibold text-foreground truncate">
                      {goal.title}
                    </h4>
                    {goal.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {goal.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className={`text-xs px-2.5 py-0.5 shrink-0 ${statusConfig.color}`}>
                    <StatusIcon className="w-3 h-3 ml-1" />
                    {statusConfig.label}
                  </Badge>
                </div>

                {/* Progress Visual */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">התקדמות ליעד:</span>
                    <span className="font-bold text-foreground font-mono">{goal.progressPercent}%</span>
                  </div>
                  <Progress value={goal.progressPercent} className="h-2 bg-muted/60" />

                  {/* Values if available */}
                  {(goal.currentValue !== null || goal.targetValue !== null) && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>
                        נוכחי: <b className="text-foreground font-mono font-semibold">{goal.currentValue?.toLocaleString('he-IL') ?? '-'} {goal.unit}</b>
                      </span>
                      <span>
                        יעד: <b className="text-indigo-400 font-mono font-semibold">{goal.targetValue?.toLocaleString('he-IL') ?? '-'} {goal.unit}</b>
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer details */}
                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>
                      {goal.targetDate
                        ? `יעד: ${new Date(goal.targetDate).toLocaleDateString('he-IL')}`
                        : 'ללא מועד סופי'}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-400"
                    onClick={() => handleDeleteGoal(goal.id, goal.title)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {goals.length === 0 && (
          <div className="col-span-full text-center py-10 bg-card/20 rounded-xl border border-dashed border-border p-6">
            <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">טרם הוגדרו יעדי צמיחה ללקוח זה</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              הגדר יעדים כלכליים מדידים (הגדלת רווח, גיוס מימון, עמידה ביעדי מכירות) כדי ללוות את צמיחת העסק.
            </p>
          </div>
        )}
      </div>

      {/* Add Goal Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[460px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>הגדרת יעד צמיחה חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label>כותרת היעד</Label>
              <Input
                placeholder="למשל: הגדלת מחזור חודשי ל-1.5 מיליון / השגת מימון בנקאי"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>תיאור ופירוט (אופציונלי)</Label>
              <Input
                placeholder="פירוט תוכנית הפעולה או הצעדים הנדרשים"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-1">
                <Label>ערך נוכחי</Label>
                <Input
                  type="number"
                  placeholder="850000"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label>ערך יעד</Label>
                <Input
                  type="number"
                  placeholder="1500000"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label>יחידה</Label>
                <Input
                  placeholder="₪"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>תאריך יעד</Label>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>סטטוס התחלתי</Label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="on_track">בקצב היעד</SelectItem>
                    <SelectItem value="behind">דורש התערבות</SelectItem>
                    <SelectItem value="achieved">הושג</SelectItem>
                    <SelectItem value="paused">מוקפא</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
              ביטול
            </Button>
            <Button
              onClick={handleSaveGoal}
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSubmitting ? 'שומר...' : 'שמור יעד'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
