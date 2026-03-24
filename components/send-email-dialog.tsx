'use client'

import { useState } from 'react'
import { Mail, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface SendEmailDialogProps {
  toEmail: string
  toName: string
  defaultSubject?: string
  defaultBody?: string
  triggerLabel?: string
  triggerVariant?: 'default' | 'outline' | 'ghost'
  triggerSize?: 'sm' | 'default' | 'icon'
  onSent?: () => void
}

export function SendEmailDialog({
  toEmail,
  toName,
  defaultSubject = '',
  defaultBody = '',
  triggerLabel,
  triggerVariant = 'ghost',
  triggerSize = 'sm',
  onSent,
}: SendEmailDialogProps) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState(defaultBody)
  const [loading, setLoading] = useState(false)

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setSubject(defaultSubject)
      setBody(defaultBody)
    }
    setOpen(v)
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('יש למלא נושא ותוכן')
      return
    }
    if (!toEmail) {
      toast.error('אין כתובת מייל ללקוח זה')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: toEmail, subject, body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בשליחה')

      toast.success(`מייל נשלח ל-${toName} בהצלחה`)
      setOpen(false)
      onSent?.()
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בשליחת המייל')
    } finally {
      setLoading(false)
    }
  }

  if (!toEmail) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {triggerSize === 'icon' ? (
          <Button variant={triggerVariant} size="icon" title={`שלח מייל ל-${toName}`} className="h-8 w-8 rounded-lg">
            <Mail className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant={triggerVariant} size={triggerSize} className="gap-2">
            <Mail className="h-3.5 w-3.5" />
            {triggerLabel || 'שלח מייל'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            שלח מייל ל-{toName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="p-3 bg-slate-50 rounded-xl text-sm text-grey font-medium">
            אל: <span className="text-navy font-bold">{toEmail}</span>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-grey">נושא</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="נושא המייל"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-grey">תוכן</Label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="תוכן המייל..."
              rows={6}
              className="rounded-xl resize-none"
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={loading || !subject.trim() || !body.trim()}
            className="w-full gap-2 rounded-xl"
          >
            <Send className="h-4 w-4" />
            {loading ? 'שולח...' : 'שלח מייל'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
