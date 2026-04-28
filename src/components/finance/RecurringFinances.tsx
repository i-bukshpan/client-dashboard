'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Repeat, Plus, Trash2, Loader2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { useRouter } from 'next/navigation'

interface Props {
  recurring: any[]
  clients: any[]
}

export function RecurringFinances({ recurring, clients }: Props) {
  const [isAdding, setIsAdding] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    
    const type = formData.get('type') as string
    const amount = Number(formData.get('amount'))
    const category = formData.get('category') as string
    const description = formData.get('description') as string
    const client_id = formData.get('client_id') as string

    const { error } = await (supabase.from('recurring_finances') as any).insert({
      type,
      amount,
      category,
      description,
      client_id: client_id !== 'none' ? client_id : null,
      active: true
    })

    setIsLoading(false)
    if (error) {
      toast({ title: 'שגיאה', description: 'שגיאה בשמירת הוראת קבע', variant: 'destructive' })
    } else {
      toast({ title: 'הצלחה', description: 'הוראת קבע נוספה בהצלחה' })
      setIsAdding(false)
      router.refresh()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק הוראת קבע זו?')) return
    const { error } = await (supabase.from('recurring_finances') as any).delete().eq('id', id)
    if (!error) {
      toast({ title: 'נמחק', description: 'הוראת הקבע הוסרה' })
      router.refresh()
    }
  }

  const income = recurring.filter(r => r.type === 'income')
  const expenses = recurring.filter(r => r.type === 'expense')
  const totalMonthlyIncome = income.reduce((s, r) => s + Number(r.amount), 0)
  const totalMonthlyExpenses = expenses.reduce((s, r) => s + Number(r.amount), 0)
  const projectedProfit = totalMonthlyIncome - totalMonthlyExpenses

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-emerald-50/50 border-emerald-100 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] text-emerald-600 font-bold uppercase">הכנסות קבועות</p>
              <p className="text-xl font-black text-emerald-700">₪{totalMonthlyIncome.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50/50 border-red-100 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-[10px] text-red-600 font-bold uppercase">הוצאות קבועות</p>
              <p className="text-xl font-black text-red-700">₪{totalMonthlyExpenses.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/50 border-blue-100 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Repeat className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] text-blue-600 font-bold uppercase">תחזית רווח חודשי (קבוע)</p>
              <p className="text-xl font-black text-blue-700">₪{projectedProfit.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-border/50 bg-muted/20">
          <CardTitle className="text-lg flex items-center gap-2">
            <Repeat className="w-5 h-5 text-primary" />
            ניהול תשלומים קבועים
          </CardTitle>
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> הוסף קבוע</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>הוספת הכנסה/הוצאה קבועה</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>סוג</Label>
                    <Select name="type" defaultValue="income">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">הכנסה</SelectItem>
                        <SelectItem value="expense">הוצאה</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>סכום חודשי *</Label>
                    <Input name="amount" type="number" required placeholder="0.00" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>קטגוריה *</Label>
                  <Input name="category" required placeholder="למשל: ריטיינר, שכירות, ענן..." />
                </div>
                <div className="space-y-2">
                  <Label>לקוח (אופציונלי)</Label>
                  <Select name="client_id" defaultValue="none">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא לקוח</SelectItem>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>תיאור</Label>
                  <Input name="description" placeholder="פרטים נוספים..." />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="w-4 h-4 me-2 animate-spin" />} שמור הגדרה
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {recurring.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground italic">אין הגדרות תשלומים קבועים</div>
            ) : (
              recurring.map(rec => (
                <div key={rec.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${rec.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {rec.type === 'income' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{rec.category}</h4>
                      <p className="text-[10px] text-muted-foreground">
                        {rec.clients?.name ? `לקוח: ${rec.clients.name}` : 'הגדרה כללית'}
                        {rec.description && ` • ${rec.description}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className={`text-sm font-black ${rec.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      ₪{Number(rec.amount).toLocaleString()}
                    </div>
                    <Button variant="ghost" size="icon" className="text-slate-300 hover:text-red-500" onClick={() => handleDelete(rec.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
