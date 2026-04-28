'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Plus, Target, User, Trash2, CheckCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { useRouter } from 'next/navigation'

interface Props {
  initialGoals: any[]
  employees: any[]
  clients: any[]
}

export function GoalsManager({ initialGoals, employees, clients }: Props) {
  const [goals, setGoals] = useState(initialGoals)
  const [isAdding, setIsAdding] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  async function handleAddGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const target_amount = formData.get('target_amount') ? Number(formData.get('target_amount')) : null
    const target_date = formData.get('target_date') as string || null
    const assigned_employee = formData.get('employee_id') as string
    const assigned_client = formData.get('client_id') as string

    const data: any = { title, description, target_amount, target_date }
    if (assigned_employee && assigned_employee !== 'none') data.assigned_employee = assigned_employee
    if (assigned_client && assigned_client !== 'none') data.assigned_client = assigned_client

    const { error } = await supabase.from('goals').insert(data)
    setIsLoading(false)

    if (error) {
      console.error('Error adding goal:', error)
      toast({ title: 'שגיאה', description: error.message || 'שגיאה ביצירת יעד', variant: 'destructive' })
    } else {
      toast({ title: 'הצלחה', description: 'היעד נוצר בהצלחה' })
      setIsAdding(false)
      router.refresh()
    }
  }

  async function updateProgress(id: string, current: number) {
    const { error } = await (supabase.from('goals') as any).update({ current_amount: current }).eq('id', id)
    if (!error) {
      setGoals(goals.map(g => g.id === id ? { ...g, current_amount: current } : g))
      router.refresh()
    }
  }

  async function toggleComplete(id: string, isCompleted: boolean) {
    const { error } = await (supabase.from('goals') as any).update({ is_completed: !isCompleted }).eq('id', id)
    if (!error) {
      setGoals(goals.map(g => g.id === id ? { ...g, is_completed: !isCompleted } : g))
      router.refresh()
    }
  }

  async function deleteGoal(id: string) {
    if (!confirm('למחוק יעד זה?')) return
    const { error } = await (supabase.from('goals') as any).delete().eq('id', id)
    if (!error) {
      setGoals(goals.filter(g => g.id !== id))
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> יעד חדש</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>הוספת יעד למעקב</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddGoal} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>כותרת היעד *</Label>
                <Input name="title" required placeholder="לדוגמה: יעד מכירות רבעוני, סיום פרויקט X..." />
              </div>
              <div className="space-y-2">
                <Label>תיאור</Label>
                <Textarea name="description" placeholder="פרטים נוספים..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>כמות יעד (אופציונלי)</Label>
                  <Input name="target_amount" type="number" placeholder="למשל: 50000" />
                </div>
                <div className="space-y-2">
                  <Label>תאריך יעד (אופציונלי)</Label>
                  <Input name="target_date" type="date" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>שייך לעובד</Label>
                  <Select name="employee_id">
                    <SelectTrigger><SelectValue placeholder="ללא עובד" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא עובד</SelectItem>
                      {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>שייך ללקוח</Label>
                  <Select name="client_id">
                    <SelectTrigger><SelectValue placeholder="ללא לקוח" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא לקוח</SelectItem>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 me-2 animate-spin" />} שמור יעד
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {goals.map(goal => {
          const progressPercent = goal.target_amount ? Math.min(100, Math.round(((goal.current_amount || 0) / goal.target_amount) * 100)) : 0
          
          return (
            <Card key={goal.id} className={`border-border/50 shadow-sm transition-all ${goal.is_completed ? 'opacity-70 bg-slate-50' : ''}`}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${goal.is_completed ? 'bg-emerald-100 text-emerald-600' : 'bg-purple-100 text-purple-600'}`}>
                      <Target className="w-4 h-4" />
                    </div>
                    <h3 className={`font-bold text-lg ${goal.is_completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>{goal.title}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className={goal.is_completed ? 'text-emerald-500' : 'text-slate-300'} onClick={() => toggleComplete(goal.id, goal.is_completed)}>
                      <CheckCircle className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteGoal(goal.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {goal.description && <p className="text-sm text-slate-600 mb-4 line-clamp-2">{goal.description}</p>}

                {(goal.assigned_employee || goal.assigned_client) && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {goal.assigned_employee && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded-md font-medium border border-blue-100">
                        <User className="w-3 h-3" /> עובד: {goal.assigned_employee.full_name}
                      </span>
                    )}
                    {goal.assigned_client && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-[10px] rounded-md font-medium border border-amber-100">
                        לקוח: {goal.assigned_client.name}
                      </span>
                    )}
                  </div>
                )}

                {goal.target_amount && (
                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{goal.current_amount}</span>
                      <span className="text-muted-foreground">מתוך {goal.target_amount}</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                    <div className="flex justify-between items-center mt-2">
                        {!goal.is_completed && (
                          <div className="flex gap-1">
                            {goal.target_amount >= 10000 ? (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 text-[10px] px-2 hover:bg-red-50 hover:text-red-600" 
                                  onClick={() => updateProgress(goal.id, Math.max(0, (goal.current_amount || 0) - 1000))}
                                >
                                  -1000
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 text-[10px] px-2 hover:bg-emerald-50 hover:text-emerald-600" 
                                  onClick={() => updateProgress(goal.id, (goal.current_amount || 0) + 1000)}
                                >
                                  +1000
                                </Button>
                              </>
                            ) : goal.target_amount >= 1000 ? (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 text-[10px] px-2 hover:bg-red-50 hover:text-red-600" 
                                  onClick={() => updateProgress(goal.id, Math.max(0, (goal.current_amount || 0) - 100))}
                                >
                                  -100
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 text-[10px] px-2 hover:bg-emerald-50 hover:text-emerald-600" 
                                  onClick={() => updateProgress(goal.id, (goal.current_amount || 0) + 100)}
                                >
                                  +100
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 text-[10px] px-2 hover:bg-red-50 hover:text-red-600" 
                                  onClick={() => updateProgress(goal.id, Math.max(0, (goal.current_amount || 0) - 1))}
                                >
                                  -1
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 text-[10px] px-2 hover:bg-emerald-50 hover:text-emerald-600" 
                                  onClick={() => updateProgress(goal.id, (goal.current_amount || 0) + 1)}
                                >
                                  +1
                                </Button>
                              </>
                            )}

                            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => {
                              const val = prompt('עדכן סכום נוכחי:', goal.current_amount)
                              if (val !== null && !isNaN(Number(val))) updateProgress(goal.id, Number(val))
                            }}>עדכן</Button>
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {goal.target_date && (
                  <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-medium text-center">
                    תאריך יעד: {new Date(goal.target_date).toLocaleDateString('he-IL')}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
        {goals.length === 0 && (
          <div className="col-span-full py-12 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <Target className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 font-medium">אין יעדים פעילים</p>
            <p className="text-xs text-slate-400 mt-1">צור את היעד הראשון שלך כדי להתחיל במעקב</p>
          </div>
        )}
      </div>
    </div>
  )
}
