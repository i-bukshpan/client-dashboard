'use client'

import React, { useState } from 'react'
import { Phone, MessageCircle, UserPlus, Users, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { ClientStakeholder } from '@/lib/v2/client-context-schema'

interface ClientStakeholdersBarProps {
  clientId?: string
  clientName: string
  clientPhone?: string | null
  clientEmail?: string | null
  stakeholders: ClientStakeholder[]
  onUpdateStakeholders?: (updated: ClientStakeholder[]) => void
}

export function ClientStakeholdersBar({
  clientName,
  clientPhone,
  stakeholders = [],
  onUpdateStakeholders,
}: ClientStakeholdersBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('מזכירה')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')

  const cleanPhone = (num?: string | null) => {
    if (!num) return ''
    return num.replace(/[^\d+]/g, '').replace(/^0/, '972')
  }

  const handleAdd = () => {
    if (!name.trim()) {
      toast.error('נא להזין שם איש קשר')
      return
    }
    const newStakeholder: ClientStakeholder = {
      name: name.trim(),
      role: role.trim(),
      notes: phone ? `${phone}${notes ? ` - ${notes}` : ''}` : notes || undefined,
    }
    const updated = [...stakeholders, newStakeholder]
    onUpdateStakeholders?.(updated)
    toast.success(`איש קשר "${name}" נוסף בהצלחה`)
    setName('')
    setPhone('')
    setNotes('')
    setIsOpen(false)
  }

  return (
    <div className="bg-card/40 backdrop-blur-xs border-b border-border px-4 py-2.5 flex items-center justify-between gap-3 overflow-x-auto">
      <div className="flex items-center gap-2 shrink-0">
        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
          <Users className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">אנשי קשר ושטח:</span>
      </div>

      {/* Action Chips */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
        {/* Main Client Chip */}
        {clientPhone && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/80 border border-border/80 text-xs text-foreground shrink-0 shadow-xs">
            <span className="font-medium">{clientName}</span>
            <span className="text-[10px] text-muted-foreground">(לקוח)</span>
            <div className="flex items-center gap-1 mr-1">
              <a
                href={`https://wa.me/${cleanPhone(clientPhone)}`}
                target="_blank"
                rel="noreferrer"
                className="p-1 hover:text-emerald-500 transition-colors"
                title="וואטסאפ ללקוח"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
              </a>
              <a
                href={`tel:${clientPhone}`}
                className="p-1 hover:text-blue-500 transition-colors"
                title="חיוג ללקוח"
              >
                <Phone className="w-3.5 h-3.5 text-blue-500" />
              </a>
            </div>
          </div>
        )}

        {/* Stakeholder Chips (e.g. Secretary, CPA, Partner) */}
        {stakeholders.map((s, idx) => {
          const phoneMatch = s.notes?.match(/(\+?\d[\d\s-]{7,})/)?.[1]
          const cleaned = cleanPhone(phoneMatch)

          return (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border/60 text-xs text-foreground shrink-0 hover:bg-secondary transition-colors"
            >
              <Briefcase className="w-3 h-3 text-muted-foreground" />
              <span className="font-medium">{s.name}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted/60">
                {s.role}
              </Badge>
              {cleaned && (
                <div className="flex items-center gap-1 mr-1">
                  <a
                    href={`https://wa.me/${cleaned}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-0.5 hover:text-emerald-500 transition-colors"
                    title={`וואטסאפ ל${s.name} (${s.role})`}
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                  </a>
                  <a
                    href={`tel:${phoneMatch}`}
                    className="p-0.5 hover:text-blue-500 transition-colors"
                    title={`חיוג ל${s.name}`}
                  >
                    <Phone className="w-3.5 h-3.5 text-blue-500" />
                  </a>
                </div>
              )}
            </div>
          )
        })}

        {/* Add Stakeholder button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="h-7 px-2.5 text-xs rounded-full border-dashed text-muted-foreground hover:text-foreground shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5 ml-1 text-indigo-400" />
          הוסף איש קשר (מזכירה / רו&quot;ח)
        </Button>
      </div>

      {/* Add Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[420px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת איש קשר לליווי הלקוח</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-2 text-sm">
            <div className="space-y-1.5">
              <Label>שם מלא</Label>
              <Input
                placeholder="לדוגמה: שרה לוי (מזכירה)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>תפקיד</Label>
              <Input
                placeholder="מזכירה / רואה חשבון / שותף / מנהל עבודה"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>מספר טלפון (וואטסאפ וחיוג מהיר)</Label>
              <Input
                placeholder="050-1234567"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>הערות (אופציונלי)</Label>
              <Input
                placeholder="שעות זמינות, תיאום חשבוניות וכו'"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              הוסף איש קשר
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
