'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ClipboardList, Plus, Trash2, Loader2, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { useRouter } from 'next/navigation'

interface ActionItem {
  title: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string
  assigned_to?: string
}

interface Props {
  appointmentId: string
  clientId: string
  employeeId?: string
  employees: any[]
  trigger?: React.ReactNode
}

export function MeetingSummaryDialog({ appointmentId, clientId, employeeId, employees, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  const addActionItem = () => {
    setActionItems([...actionItems, { title: '', priority: 'medium', assigned_to: employeeId || 'none' }])
  }

  const updateActionItem = (index: number, field: keyof ActionItem, value: any) => {
    const newItems = [...actionItems]
    newItems[index] = { ...newItems[index], [field]: value }
    setActionItems(newItems)
  }

  const removeActionItem = (index: number) => {
    setActionItems(actionItems.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!notes) {
      toast({ title: 'שגיאה', description: 'יש להזין סיכום פגישה', variant: 'destructive' })
      return
    }

    setIsLoading(true)

    // 1. Save Meeting Summary
    const { error: summaryError } = await (supabase.from('meeting_summaries') as any).insert({
      appointment_id: appointmentId,
      notes,
      action_items: actionItems as any
    })

    if (summaryError) {
      toast({ title: 'שגיאה', description: 'שגיאה בשמירת הסיכום', variant: 'destructive' })
      setIsLoading(false)
      return
    }

    // 2. Create Follow-up Tasks if any
    if (actionItems.length > 0) {
      const tasksToCreate = actionItems.filter(item => item.title).map(item => ({
        title: item.title,
        status: 'todo',
        priority: item.priority,
        due_date: item.due_date || null,
        assigned_to: item.assigned_to && item.assigned_to !== 'none' ? item.assigned_to : null,
        client_id: clientId,
        description: `משימת המשך מהפגישה בסיכום המצורף.`
      }))

      if (tasksToCreate.length > 0) {
        const { error: tasksError } = await (supabase.from('tasks') as any).insert(tasksToCreate)
        if (tasksError) {
          toast({ title: 'שים לב', description: 'הסיכום נשמר אך חלה שגיאה ביצירת חלק מהמשימות', variant: 'destructive' })
        }
      }
    }

    // 3. Update Appointment status
    await (supabase.from('appointments') as any).update({ status: 'done' }).eq('id', appointmentId)

    setIsLoading(false)
    toast({ title: 'הצלחה', description: 'סיכום הפגישה והמשימות נשמרו' })
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            סכם פגישה
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            סיכום פגישה ומשימות המשך
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label>סיכום הפגישה *</Label>
            <Textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="כתוב כאן את עיקרי הדברים שנאמרו בפגישה..."
              className="min-h-[150px] resize-y"
              dir="auto"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                משימות המשך (Action Items)
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={addActionItem} className="text-emerald-600">
                <Plus className="w-3 h-3 me-1" /> משימה
              </Button>
            </div>

            <div className="space-y-3">
              {actionItems.map((item, index) => (
                <div key={index} className="p-4 border rounded-xl bg-slate-50 relative group">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 left-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeActionItem(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[10px] uppercase font-bold text-slate-400">כותרת המשימה</Label>
                      <Input 
                        value={item.title} 
                        onChange={(e) => updateActionItem(index, 'title', e.target.value)} 
                        placeholder="מה צריך לעשות?"
                        className="bg-white"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-[10px] uppercase font-bold text-slate-400">עדיפות</Label>
                        <Select value={item.priority} onValueChange={(val: any) => updateActionItem(index, 'priority', val)}>
                          <SelectTrigger className="bg-white h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">נמוכה</SelectItem>
                            <SelectItem value="medium">בינונית</SelectItem>
                            <SelectItem value="high">גבוהה</SelectItem>
                            <SelectItem value="urgent">דחוף</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase font-bold text-slate-400">תאריך יעד</Label>
                        <Input 
                          type="date" 
                          value={item.due_date || ''} 
                          onChange={(e) => updateActionItem(index, 'due_date', e.target.value)} 
                          className="bg-white h-8 text-xs px-2"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase font-bold text-slate-400">אחראי</Label>
                        <Select value={item.assigned_to || 'none'} onValueChange={(val: any) => updateActionItem(index, 'assigned_to', val)}>
                          <SelectTrigger className="bg-white h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">ללא אחראי</SelectItem>
                            {employees.map(emp => (
                              <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {actionItems.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-4 bg-slate-50/50 rounded-xl border border-dashed">
                  אין משימות המשך מוגדרות. לחץ על הוספה במידה ויש כאלו.
                </p>
              )}
            </div>
          </div>

          <Button onClick={handleSave} className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            שמור סיכום וסגור פגישה
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
