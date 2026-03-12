'use client'

import { useState, useEffect } from 'react'
import { Plus, Calendar, Users, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

interface CreateTaskDialogProps {
  clientId?: string
  clientName?: string
  defaultDate?: string
  onCreated?: () => void
  trigger?: React.ReactNode
}

export function CreateTaskDialog({ clientId, clientName, defaultDate, onCreated, trigger }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [selectedClientId, setSelectedClientId] = useState(clientId || '')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(defaultDate || format(new Date(), 'yyyy-MM-dd'))
  const [priority, setPriority] = useState('רגיל')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!clientId) {
      supabase.from('clients').select('id, name').is('parent_id', null).order('name')
        .then(({ data }) => { if (data) setClients(data) })
    }
  }, [clientId])

  const handleCreate = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await supabase.from('reminders').insert([{
        title: title.trim(),
        client_id: selectedClientId || null,
        due_date: dueDate,
        priority,
        category: category || null,
        is_completed: false,
      }])
      setOpen(false)
      setTitle('')
      setCategory('')
      setPriority('רגיל')
      onCreated?.()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="rounded-xl border-border/50 bg-white/50 font-bold gap-2 h-11 px-5 text-sm">
            <Plus className="h-4 w-4" />
            משימה חדשה
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-[2rem] p-8" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-navy">
            {clientName ? `משימה עבור ${clientName}` : 'משימה חדשה'}
          </DialogTitle>
          <DialogDescription>הוסף משימה או תזכורת</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {!clientId && (
            <div className="space-y-2">
              <Label className="font-bold flex items-center gap-2"><Users className="h-3.5 w-3.5" />לקוח (אופציונלי)</Label>
              <Select value={selectedClientId || 'none'} onValueChange={(val) => setSelectedClientId(val === 'none' ? '' : val)}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="בחר לקוח או השאר ריק..." /></SelectTrigger>
                <SelectContent className="rounded-xl max-h-60">
                  <SelectItem value="none">ללא לקוח (אישי)</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="font-bold">כותרת</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="לדוגמה: להתקשר ללקוח" className="rounded-xl h-11" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-bold flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />תאריך יעד</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold flex items-center gap-2"><Flag className="h-3.5 w-3.5" />עדיפות</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="דחוף">🔴 דחוף</SelectItem>
                  <SelectItem value="רגיל">🟡 רגיל</SelectItem>
                  <SelectItem value="נמוך">🟢 נמוך</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-bold">קטגוריה (אופציונלי)</Label>
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="לדוגמה: מעקב, טלפוני, מייל..." className="rounded-xl h-11" />
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl h-11 px-6">ביטול</Button>
          <Button onClick={handleCreate} disabled={saving || !title.trim()} className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20 font-bold">
            {saving ? 'שומר...' : 'צור משימה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
