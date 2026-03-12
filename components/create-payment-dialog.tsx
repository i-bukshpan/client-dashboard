'use client'

import { useState, useEffect } from 'react'
import { Plus, Calendar, Users, Wallet, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

interface CreatePaymentDialogProps {
  clientId?: string
  clientName?: string
  onCreated?: () => void
  trigger?: React.ReactNode
}

export function CreatePaymentDialog({ clientId, clientName, onCreated, trigger }: CreatePaymentDialogProps) {
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [selectedClientId, setSelectedClientId] = useState(clientId || '')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paymentStatus, setPaymentStatus] = useState('ממתין')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!clientId) {
      supabase.from('clients').select('id, name').is('parent_id', null).order('name')
        .then(({ data }) => { if (data) setClients(data) })
    }
  }, [clientId])

  const handleCreate = async () => {
    if (!amount || !selectedClientId) return
    setSaving(true)
    try {
      await supabase.from('payments').insert([{
        client_id: selectedClientId,
        amount: parseFloat(amount),
        payment_date: paymentDate,
        payment_status: paymentStatus,
        payment_method: paymentMethod || null,
        description: description || null,
      }])
      setOpen(false)
      setAmount('')
      setDescription('')
      setPaymentMethod('')
      setPaymentStatus('ממתין')
      onCreated?.()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="rounded-xl border-border/50 bg-white/50 font-bold gap-2 h-11 px-5 text-sm">
            <Wallet className="h-4 w-4" />
            תשלום חדש
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-[2rem] p-8" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-navy">
            {clientName ? `תשלום עבור ${clientName}` : 'רישום תשלום חדש'}
          </DialogTitle>
          <DialogDescription>הוסף תשלום למעקב</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {!clientId && (
            <div className="space-y-2">
              <Label className="font-bold flex items-center gap-2"><Users className="h-3.5 w-3.5" />לקוח</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="בחר לקוח..." /></SelectTrigger>
                <SelectContent className="rounded-xl max-h-60">
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-bold flex items-center gap-2"><Wallet className="h-3.5 w-3.5" />סכום (₪)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />תאריך</Label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="rounded-xl h-11" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-bold">סטטוס</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="שולם">✅ שולם</SelectItem>
                  <SelectItem value="ממתין">⏳ ממתין</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-bold flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" />אמצעי תשלום</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="בחר..." /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="העברה">העברה בנקאית</SelectItem>
                  <SelectItem value="צ'ק">צ'ק</SelectItem>
                  <SelectItem value="מזומן">מזומן</SelectItem>
                  <SelectItem value="אשראי">כרטיס אשראי</SelectItem>
                  <SelectItem value="אחר">אחר</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-bold">תיאור (אופציונלי)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="לדוגמה: ייעוץ חודשי" className="rounded-xl h-11" />
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl h-11 px-6">ביטול</Button>
          <Button onClick={handleCreate} disabled={saving || !amount || !selectedClientId} className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20 font-bold bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'שומר...' : 'רשום תשלום'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
