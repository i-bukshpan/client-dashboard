'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Edit, Trash2, Target, TrendingUp } from 'lucide-react'
import { getGoals, createGoal, updateGoal, deleteGoal, updateGoalProgress } from '@/lib/actions/goals'
import { getFinancialSummary } from '@/lib/actions/analytics'
import { supabase } from '@/lib/supabase'
import type { Goal } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'

export default function GoalsPage() {
  const { showToast } = useToast()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  
  // Form state
  const [goalType, setGoalType] = useState<'revenue' | 'clients' | 'payments' | 'custom'>('revenue')
  const [targetValue, setTargetValue] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    loadGoals()
  }, [])

  useEffect(() => {
    // Update goal progress periodically
    const interval = setInterval(() => {
      updateGoalProgresses()
    }, 60000) // Every minute

    return () => clearInterval(interval)
  }, [goals])

  const loadGoals = async () => {
    setLoading(true)
    try {
      const result = await getGoals()
      if (result.success && result.goals) {
        setGoals(result.goals)
        await updateGoalProgresses(result.goals)
      }
    } catch (error) {
      console.error('Error loading goals:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateGoalProgresses = async (goalsToUpdate = goals) => {
    for (const goal of goalsToUpdate.filter(g => g.status === 'active')) {
      let currentValue = 0

      if (goal.goal_type === 'revenue') {
        const summary = await getFinancialSummary()
        if (summary.success && summary.summary) {
          currentValue = summary.summary.totalRevenue
        }
      } else if (goal.goal_type === 'clients') {
        const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true })
        currentValue = count || 0
      } else if (goal.goal_type === 'payments') {
        const { count } = await supabase.from('payments').select('*', { count: 'exact', head: true })
        currentValue = count || 0
      }

      if (currentValue !== goal.current_value) {
        await updateGoalProgress(goal.id, currentValue)
      }
    }
    loadGoals()
  }

  const handleOpenDialog = (goal?: Goal) => {
    if (goal) {
      setSelectedGoal(goal)
      setGoalType(goal.goal_type)
      setTargetValue(goal.target_value.toString())
      setTargetDate(goal.target_date.split('T')[0])
      setTitle(goal.title || '')
      setDescription(goal.description || '')
    } else {
      setSelectedGoal(null)
      setGoalType('revenue')
      setTargetValue('')
      setTargetDate('')
      setTitle('')
      setDescription('')
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!targetValue || !targetDate) {
      showToast('error', 'יש למלא סכום יעד ותאריך יעד')
      return
    }

    try {
      const goalData = {
        goal_type: goalType,
        target_value: parseFloat(targetValue),
        target_date: targetDate,
        title: title || null,
        description: description || null,
        status: 'active' as const,
      }

      if (selectedGoal) {
        const result = await updateGoal(selectedGoal.id, goalData)
        if (result.success) {
          showToast('success', 'יעד עודכן בהצלחה')
          setDialogOpen(false)
          loadGoals()
        } else {
          showToast('error', result.error || 'שגיאה בעדכון יעד')
        }
      } else {
        const result = await createGoal(goalData)
        if (result.success) {
          showToast('success', 'יעד נוצר בהצלחה')
          setDialogOpen(false)
          loadGoals()
        } else {
          showToast('error', result.error || 'שגיאה ביצירת יעד')
        }
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק יעד זה?')) return

    try {
      const result = await deleteGoal(id)
      if (result.success) {
        showToast('success', 'יעד נמחק בהצלחה')
        loadGoals()
      } else {
        showToast('error', result.error || 'שגיאה במחיקת יעד')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    }
  }

  const getProgressPercentage = (goal: Goal) => {
    if (goal.target_value === 0) return 0
    return Math.min((goal.current_value / goal.target_value) * 100, 100)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-grey">טוען יעדים...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8" dir="rtl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy mb-2">מעקב מטרות ויעדים</h1>
          <p className="text-grey">הגדר ועקוב אחר יעדים עסקיים</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          הוסף יעד חדש
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => {
          const progress = getProgressPercentage(goal)
          const isAchieved = goal.status === 'achieved'
          const statusLabels = {
            active: 'פעיל',
            achieved: 'הושג',
            failed: 'נכשל',
            cancelled: 'בוטל',
          }

          return (
            <Card key={goal.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-emerald" />
                  <div>
                    <h3 className="font-semibold text-lg">{goal.title || goal.goal_type}</h3>
                    <span className={`text-xs px-2 py-1 rounded ${
                      isAchieved ? 'bg-emerald/10 text-emerald' :
                      goal.status === 'failed' ? 'bg-red/10 text-red' :
                      'bg-blue/10 text-blue'
                    }`}>
                      {statusLabels[goal.status]}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(goal)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(goal.id)} className="text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {goal.description && (
                <p className="text-sm text-grey mb-4">{goal.description}</p>
              )}

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-grey">התקדמות</span>
                  <span className="text-sm font-semibold">{progress.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-grey/20 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      isAchieved ? 'bg-emerald' : 'bg-blue'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-grey">נוכחי:</span>
                  <span className="font-semibold">{goal.current_value.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-grey">יעד:</span>
                  <span className="font-semibold">{goal.target_value.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-grey">תאריך יעד:</span>
                  <span className="font-semibold">{new Date(goal.target_date).toLocaleDateString('he-IL')}</span>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {goals.length === 0 && (
        <Card className="p-12 text-center">
          <Target className="h-12 w-12 text-grey mx-auto mb-4" />
          <p className="text-grey mb-4">אין יעדים מוגדרים</p>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            הוסף יעד ראשון
          </Button>
        </Card>
      )}

      {/* Goal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedGoal ? 'ערוך יעד' : 'הוסף יעד חדש'}</DialogTitle>
            <DialogDescription>
              {selectedGoal ? 'ערוך את פרטי היעד' : 'הגדר יעד חדש למעקב'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>סוג יעד</Label>
              <Select value={goalType} onValueChange={(v: any) => setGoalType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">הכנסות</SelectItem>
                  <SelectItem value="clients">מספר לקוחות</SelectItem>
                  <SelectItem value="payments">מספר תשלומים</SelectItem>
                  <SelectItem value="custom">מותאם אישית</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>כותרת</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="כותרת היעד"
              />
            </div>
            <div className="grid gap-2">
              <Label>סכום יעד *</Label>
              <Input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="0"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>תאריך יעד *</Label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>תיאור</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="תיאור נוסף"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleSave}>
              {selectedGoal ? 'עדכן' : 'יצור'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

