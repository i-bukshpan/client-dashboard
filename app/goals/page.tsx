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
    const activeGoals = goalsToUpdate.filter(g => g.status === 'active')
    if (activeGoals.length === 0) return

    // ── Optimized: batch all queries in parallel instead of per-goal ──
    const needsRevenue = activeGoals.some(g => g.goal_type === 'revenue')
    const needsClients = activeGoals.some(g => g.goal_type === 'clients')
    const needsPayments = activeGoals.some(g => g.goal_type === 'payments')

    const [revenueResult, clientsCountResult, paymentsCountResult] = await Promise.all([
      needsRevenue ? getFinancialSummary() : Promise.resolve(null),
      needsClients ? supabase.from('clients').select('*', { count: 'exact', head: true }) : Promise.resolve(null),
      needsPayments ? supabase.from('payments').select('*', { count: 'exact', head: true }) : Promise.resolve(null),
    ])

    const revenueValue = revenueResult?.success && revenueResult?.summary ? revenueResult.summary.totalRevenue : 0
    const clientsCount = (clientsCountResult as any)?.count || 0
    const paymentsCount = (paymentsCountResult as any)?.count || 0

    // Update only goals whose value actually changed
    const updatePromises = activeGoals
      .map(goal => {
        let currentValue = 0
        if (goal.goal_type === 'revenue') currentValue = revenueValue
        else if (goal.goal_type === 'clients') currentValue = clientsCount
        else if (goal.goal_type === 'payments') currentValue = paymentsCount

        if (currentValue !== goal.current_value) {
          return updateGoalProgress(goal.id, currentValue)
        }
        return null
      })
      .filter(Boolean)

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises)
      // Only reload if something actually changed
      const result = await getGoals()
      if (result.success && result.goals) {
        setGoals(result.goals)
      }
    }
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
      <div className="p-6 sm:p-8">
        <div className="mb-8 animate-pulse">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-56 shimmer rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8" dir="rtl">
      <div className="mb-10 flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-extrabold text-navy tracking-tight mb-2">מעקב מטרות ויעדים</h1>
          <div className="flex items-center gap-2">
            <div className="h-1 w-12 bg-emerald rounded-full" />
            <p className="text-grey font-medium">הגדר ועקוב אחר יעדים עסקיים</p>
          </div>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 rounded-xl shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5">
          <Plus className="h-4 w-4" />
          הוסף יעד חדש
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal, i) => {
          const progress = getProgressPercentage(goal)
          const isAchieved = goal.status === 'achieved'
          const statusLabels: Record<string, string> = {
            active: 'פעיל',
            achieved: 'הושג',
            failed: 'נכשל',
            cancelled: 'בוטל',
          }
          const statusColors: Record<string, string> = {
            active: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
            achieved: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
            failed: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400',
            cancelled: 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400',
          }

          return (
            <div key={goal.id} className={`glass-card hover-lift rounded-2xl p-6 animate-fade-in-up relative overflow-hidden ${i > 0 ? `delay-${Math.min(i, 5) * 100}` : ''}`}>
              {/* Decorative accent */}
              <div className={`absolute top-0 left-0 w-full h-1 ${isAchieved ? 'bg-gradient-to-r from-emerald to-emerald-300' : 'bg-gradient-to-r from-primary to-blue-300'}`} />

              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${isAchieved ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-blue-50 dark:bg-blue-500/10'}`}>
                    <Target className={`h-4.5 w-4.5 ${isAchieved ? 'text-emerald' : 'text-primary'}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-navy">{goal.title || goal.goal_type}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[goal.status] || statusColors.active}`}>
                      {statusLabels[goal.status]}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(goal)} className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    <Edit className="h-3.5 w-3.5 text-grey" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(goal.id)} className="h-8 w-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-grey hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {goal.description && (
                <p className="text-sm text-grey mb-4 leading-relaxed">{goal.description}</p>
              )}

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-grey">התקדמות</span>
                  <span className="text-sm font-extrabold text-navy">{progress.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-200/60 dark:bg-slate-700/50 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-700 ease-out ${isAchieved ? 'bg-gradient-to-r from-emerald to-emerald-400' : 'bg-gradient-to-r from-primary to-blue-400'
                      }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-700/30">
                  <span className="text-grey">נוכחי</span>
                  <span className="font-bold text-navy">{goal.current_value.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-700/30">
                  <span className="text-grey">יעד</span>
                  <span className="font-bold text-navy">{goal.target_value.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-grey">תאריך יעד</span>
                  <span className="font-bold text-navy">{new Date(goal.target_date).toLocaleDateString('he-IL')}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {goals.length === 0 && (
        <div className="glass-card rounded-2xl p-16 text-center animate-fade-in-up">
          <Target className="h-16 w-16 text-grey/20 mx-auto mb-4" />
          <p className="text-grey font-medium mb-5">אין יעדים מוגדרים</p>
          <Button onClick={() => handleOpenDialog()} className="gap-2 rounded-xl shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" />
            הוסף יעד ראשון
          </Button>
        </div>
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

