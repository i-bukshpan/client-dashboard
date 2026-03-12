'use client'

import { useState, useEffect } from 'react'
import { Plus, Calendar, Clock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { supabase, type Client } from '@/lib/supabase'
import { createMeetingLog } from '@/lib/actions/meeting-logs'
import { format } from 'date-fns'

interface CreateMeetingDialogProps {
  /** If provided, pre-selects this client */
  clientId?: string
  clientName?: string
  /** Pre-fill date */
  defaultDate?: string
  /** Called after successful creation */
  onCreated?: () => void
  /** Custom trigger button */
  trigger?: React.ReactNode
}

export function CreateMeetingDialog({ clientId, clientName, defaultDate, onCreated, trigger }: CreateMeetingDialogProps) {
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [selectedClientId, setSelectedClientId] = useState(clientId || '')
  const [meetingDate, setMeetingDate] = useState(defaultDate || format(new Date(), 'yyyy-MM-dd'))
  const [meetingTime, setMeetingTime] = useState('10:00')
  const [subject, setSubject] = useState('')
  const [summary, setSummary] = useState('')
  const [actionItems, setActionItems] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!clientId) {
      supabase
        .from('clients')
        .select('id, name')
        .is('parent_id', null)
        .order('name')
        .then(({ data }) => {
          if (data) setClients(data)
        })
    }
  }, [clientId])

  const handleCreate = async () => {
    if (!subject.trim() || !selectedClientId) return
    setSaving(true)

    const result = await createMeetingLog({
      client_id: selectedClientId,
      meeting_date: `${meetingDate}T${meetingTime}:00`,
      subject: subject.trim(),
      summary: summary.trim() || undefined,
      action_items: actionItems.trim() || undefined,
      meeting_type: 'scheduled'
    })

    if (result.success) {
      setOpen(false)
      setSubject('')
      setSummary('')
      setActionItems('')
      onCreated?.()
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 h-11 px-5 shadow-lg shadow-blue-500/20">
            <Plus className="h-4 w-4" />
            פגישה חדשה
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-[2rem] p-8" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-navy">
            {clientName ? `פגישה עם ${clientName}` : 'קביעת פגישה חדשה'}
          </DialogTitle>
          <DialogDescription>מלא את פרטי הפגישה</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {/* Client selector (only if not pre-selected) */}
          {!clientId && (
            <div className="space-y-2">
              <Label className="font-bold flex items-center gap-2"><Users className="h-3.5 w-3.5" />לקוח</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="בחר לקוח..." /></SelectTrigger>
                <SelectContent className="rounded-xl max-h-60">
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-bold flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />תאריך</Label>
              <Input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold flex items-center gap-2"><Clock className="h-3.5 w-3.5" />שעה</Label>
              <Input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} className="rounded-xl h-11" />
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label className="font-bold">נושא / כותרת</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="לדוגמה: פגישת סטטוס רבעונית" className="rounded-xl h-11" />
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <Label className="font-bold">הערות מקדימות (אופציונלי)</Label>
            <Textarea value={summary} onChange={e => setSummary(e.target.value)} placeholder="נקודות לדיון, הכנה מראש..." className="rounded-xl min-h-[80px] resize-none" />
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl h-11 px-6">ביטול</Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !subject.trim() || !selectedClientId}
            className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20 font-bold"
          >
            {saving ? 'שומר...' : 'צור פגישה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
