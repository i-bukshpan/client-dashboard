'use client'

/**
 * src/components/workspace/ClientProfileSidebar.tsx
 *
 * Full client profile panel for Nehemiah OS v2 Workspace.
 * Supports:
 * - Desktop sidebar (fixed left/right split view)
 * - Mobile Sheet/Drawer triggered from the workspace top-bar
 * - Tabular numbers and Bidi text isolation for phones/emails
 */

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Mail,
  Phone,
  MapPin,
  Users,
  ArrowLeft,
  FolderOpen,
  TableIcon,
  ExternalLink,
  User,
  MessageCircle,
  Plus,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
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
import { EditClientModal } from '@/components/workspace/EditClientModal'
import { ClientContextCard } from '@/components/workspace/ClientContextCard'
import { addClientStakeholderAction } from '@/app/workspace/actions/client-ecosystem'
import type { WorkspaceClientRecord } from '@/lib/v2/workspace-dal'
import type { ClientContext, ClientStakeholder } from '@/lib/v2/client-context-schema'

interface ClientProfileSidebarProps {
  client: WorkspaceClientRecord
  clientContext: ClientContext | null
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: 'פעיל', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    prospect: { label: 'פוטנציאל', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    inactive: { label: 'לא פעיל', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
    archived: { label: 'ארכיון', cls: 'bg-red-100 text-red-600 border-red-200' },
  }
  const s = map[status ?? 'active'] ?? map.active
  return (
    <Badge variant="outline" className={`text-[10px] font-bold ${s.cls}`}>
      {s.label}
    </Badge>
  )
}

function WorkspaceStatusRow({
  hasDrive,
  hasSheet,
  gmailLabel,
  hasEmail,
}: {
  hasDrive: boolean
  hasSheet: boolean
  gmailLabel?: string | null
  hasEmail?: boolean
}) {
  const hasGmail = Boolean(gmailLabel || hasEmail)
  return (
    <div className="space-y-2 mt-3">
      <div className="grid grid-cols-2 gap-2">
        <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${hasDrive ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-dashed border-border'}`}>
          <FolderOpen className={`w-4 h-4 ${hasDrive ? 'text-amber-500' : 'text-muted-foreground/30'}`} />
          <div>
            <p className={`text-[10px] font-bold ${hasDrive ? 'text-amber-700' : 'text-muted-foreground/50'}`}>Drive</p>
            <p className="text-[9px] text-muted-foreground/60">{hasDrive ? 'מחובר' : 'לא הוגדר'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${hasSheet ? 'bg-emerald-50/60 border-emerald-200' : 'bg-slate-50 border-dashed border-border'}`}>
          <TableIcon className={`w-4 h-4 ${hasSheet ? 'text-emerald-500' : 'text-muted-foreground/30'}`} />
          <div>
            <p className={`text-[10px] font-bold ${hasSheet ? 'text-emerald-700' : 'text-muted-foreground/50'}`}>Sheets</p>
            <p className="text-[9px] text-muted-foreground/60">{hasSheet ? 'מחובר' : 'לא הוגדר'}</p>
          </div>
        </div>
      </div>
      <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${hasGmail ? 'bg-red-50/60 border-red-200' : 'bg-slate-50 border-dashed border-border'}`}>
        <Mail className={`w-4 h-4 ${hasGmail ? 'text-red-500' : 'text-muted-foreground/30'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <p className={`text-[10px] font-bold ${hasGmail ? 'text-red-700' : 'text-muted-foreground/50'}`}>Gmail</p>
            {gmailLabel && <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.2 rounded truncate max-w-[100px]">{gmailLabel}</span>}
          </div>
          <p className="text-[9px] text-muted-foreground/60 truncate">
            {gmailLabel ? `תווית: ${gmailLabel}` : hasEmail ? 'חיפוש לפי אימייל' : 'לא הוגדר'}
          </p>
        </div>
      </div>
    </div>
  )
}

function SidebarStakeholdersSection({
  clientId,
  stakeholders = [],
}: {
  clientId: string
  stakeholders: ClientStakeholder[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('מזכירה')
  const [phone, setPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const cleanPhone = (num?: string | null) => {
    if (!num) return ''
    return num.replace(/[^\d+]/g, '').replace(/^0/, '972')
  }

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error('נא להזין שם איש קשר')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await addClientStakeholderAction(clientId, {
        name: name.trim(),
        role: role.trim(),
        notes: phone.trim() ? phone.trim() : undefined,
      })
      if (res.success) {
        toast.success(`איש קשר "${name}" נוסף בהצלחה`)
        setName('')
        setPhone('')
        setIsOpen(false)
      } else {
        toast.error(res.error || 'שגיאה בהוספת איש קשר')
      }
    } catch {
      toast.error('שגיאה בלתי צפויה')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="px-5 py-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {"אנשי קשר (מזכירה / רו\"ח)"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="h-6 px-1.5 text-[11px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 font-semibold"
        >
          <Plus className="w-3 h-3" />
          <span>הוסף</span>
        </Button>
      </div>

      {stakeholders.length === 0 ? (
        <div className="p-2.5 rounded-lg border border-dashed border-border/80 bg-muted/10 text-center">
          <p className="text-[11px] text-muted-foreground">טרם הוגדרו אנשי קשר נוספים</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stakeholders.map((s, i) => {
            const phoneMatch = s.notes?.match(/(\+?\d[\d\s-]{7,})/)?.[1] || (s.notes?.trim() && /^[\d\s+-]+$/.test(s.notes.trim()) ? s.notes.trim() : null)
            const cleaned = cleanPhone(phoneMatch)

            return (
              <div
                key={i}
                className="p-2 rounded-lg border border-border/70 bg-card flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground truncate">{s.name}</span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1 bg-indigo-50 text-indigo-700 border-indigo-200">
                      {s.role}
                    </Badge>
                  </div>
                  {phoneMatch && (
                    <bdi dir="ltr" className="text-[10px] text-muted-foreground font-mono block truncate">
                      {phoneMatch}
                    </bdi>
                  )}
                </div>

                {phoneMatch && (
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={`https://wa.me/${cleaned}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 rounded hover:bg-emerald-50 text-emerald-600 transition-colors"
                      title={`וואטסאפ אל ${s.name}`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={`tel:${phoneMatch}`}
                      className="p-1 rounded hover:bg-blue-50 text-blue-600 transition-colors"
                      title={`חיוג אל ${s.name}`}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              {"הוספת איש קשר (מזכירה / רו\"ח / שותף)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-right">
            <div className="space-y-1">
              <Label className="text-xs">שם איש הקשר</Label>
              <Input
                placeholder="למשל: רחל (מזכירה) / ישראל כהן (רו״ח)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">תפקיד</Label>
              <Input
                placeholder="מזכירה / רואה חשבון / מנהל תפעול / שותף"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">טלפון (לוואטסאפ וחיוג מהיר)</Label>
              <Input
                placeholder="050-1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-xs font-mono"
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
              ביטול
            </Button>
            <Button
              size="sm"
              disabled={isSubmitting}
              onClick={handleAdd}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSubmitting ? 'שומר...' : 'שמור איש קשר'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SidebarInnerContent({
  client,
  clientContext,
}: ClientProfileSidebarProps) {
  const c = client
  const initials = c.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  const sheetsUrl = c.google_sheet_id
    ? `https://docs.google.com/spreadsheets/d/${c.google_sheet_id}`
    : null
  const driveUrl = c.drive_folder_id
    ? `https://drive.google.com/drive/folders/${c.drive_folder_id}`
    : null

  return (
    <div className="divide-y divide-border/50 text-sm">
      {/* Back link */}
      <div className="px-4 pt-4 pb-2">
        <Link
          href="/workspace/clients"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
          חזרה לרשימה
        </Link>
      </div>

      {/* Avatar + name */}
      <div className="px-5 pt-3 pb-5 text-center">
        <div className="relative inline-block mb-3">
          <Avatar className="w-20 h-20 border-4 border-background shadow-xl">
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-2xl font-black">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background shadow" />
        </div>
        <h1 className="font-black text-lg text-foreground leading-tight">{c.name}</h1>
        <div className="mt-1.5 flex items-center justify-center gap-2">
          <StatusBadge status={c.status} />
        </div>
        <div className="mt-3">
          <EditClientModal client={c} />
        </div>
      </div>

      {/* Contact info */}
      <div className="px-5 py-4 space-y-2.5">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
          פרטי התקשרות
        </p>
        {c.email && (
          <div className="flex items-center justify-between text-xs text-foreground/80 group">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                <Mail className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <bdi dir="ltr" className="truncate font-mono select-all text-xs">{c.email}</bdi>
            </div>
            <a
              href={`mailto:${c.email}`}
              className="p-1 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              title="שלח דוא״ל"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
        {c.phone && (
          <div className="flex items-center justify-between text-xs text-foreground/80">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-green-50 flex items-center justify-center shrink-0">
                <Phone className="w-3.5 h-3.5 text-green-500" />
              </div>
              <bdi dir="ltr" className="font-mono select-all tabular-nums text-xs">{c.phone}</bdi>
            </div>
            <div className="flex items-center gap-1">
              <a
                href={`https://wa.me/${c.phone.replace(/[^\d+]/g, '').replace(/^0/, '972')}`}
                target="_blank"
                rel="noreferrer"
                className="p-1 rounded hover:bg-emerald-50 text-emerald-600 transition-colors"
                title="וואטסאפ ללקוח"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </a>
              <a
                href={`tel:${c.phone}`}
                className="p-1 rounded hover:bg-blue-50 text-blue-600 transition-colors"
                title="חיוג ללקוח"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
        {c.address && (
          <div className="flex items-center gap-2 text-xs text-foreground/80">
            <div className="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center shrink-0">
              <MapPin className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <span className="text-xs truncate">{c.address}</span>
          </div>
        )}
      </div>

      {/* Stakeholders (Secretary, CPA, etc.) */}
      <SidebarStakeholdersSection clientId={c.id} stakeholders={clientContext?.stakeholders || []} />

      {/* Advisory info */}
      {(c.portfolio_value || c.advisory_goal || c.risk_level) && (
        <div className="px-5 py-4 space-y-2.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            פרופיל ייעוצי
          </p>
          {c.portfolio_value && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">שווי תיק</span>
              <span className="text-xs font-bold text-foreground font-mono tabular-nums">
                ₪{c.portfolio_value.toLocaleString()}
              </span>
            </div>
          )}
          {c.advisory_goal && (
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-muted-foreground shrink-0">מטרה</span>
              <span className="text-xs font-medium text-foreground text-right">{c.advisory_goal}</span>
            </div>
          )}
          {c.risk_level && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">סיכון</span>
              <Badge variant="outline" className="text-[10px]">{c.risk_level}</Badge>
            </div>
          )}
        </div>
      )}

      {/* Unified Google Workspace section */}
      <div className="px-5 py-4 space-y-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
          חיבורי Google Workspace
        </p>
        <div className="space-y-1.5">
          {driveUrl ? (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 rounded-lg bg-amber-50 hover:bg-amber-100/80 border border-amber-200 transition-colors group text-xs text-amber-900"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-semibold">תיקיית Drive ראשית</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-amber-500 group-hover:text-amber-700" />
            </a>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
              <FolderOpen className="w-4 h-4 opacity-40" />
              <span>Drive: לא הוגדר</span>
            </div>
          )}

          {sheetsUrl ? (
            <a
              href={sheetsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 transition-colors group text-xs text-emerald-900"
            >
              <div className="flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">גיליון Sheets ראשי</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-500 group-hover:text-emerald-700" />
            </a>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
              <TableIcon className="w-4 h-4 opacity-40" />
              <span>Sheets: לא הוגדר</span>
            </div>
          )}

          {c.gmail_label && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900">
              <div className="flex items-center gap-2 truncate">
                <Mail className="w-4 h-4 text-red-500 shrink-0" />
                <span className="truncate">תווית דוא״ל: {c.gmail_label}</span>
              </div>
              <Badge variant="outline" className="text-[9px] bg-red-100 text-red-700 border-red-300">פעיל</Badge>
            </div>
          )}
        </div>
      </div>

      {/* Client context card */}
      <div className="px-5 py-4">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
          פרופיל עסקי
        </p>
        {clientContext ? (
          <ClientContextCard context={clientContext} />
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 px-3 py-2.5">
            <div className="w-4 h-4 rounded-full bg-indigo-200 flex items-center justify-center shrink-0">
              <span className="text-[9px] text-indigo-600 font-black">?</span>
            </div>
            <p className="text-[10px] text-indigo-600/80 leading-tight">
              פרופיל עסקי טרם הוגדר — פתח את סוכן ה-AI להתחלת האפיון
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function ClientProfileSidebar({
  client,
  clientContext,
}: ClientProfileSidebarProps) {
  return (
    <aside className="hidden lg:block w-72 shrink-0 border-l border-border overflow-y-auto bg-card">
      <SidebarInnerContent client={client} clientContext={clientContext} />
    </aside>
  )
}

export function ClientProfileMobileTrigger({
  client,
  clientContext,
}: ClientProfileSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="lg:hidden">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs font-bold bg-card border-border hover:bg-muted"
          >
            <User className="w-3.5 h-3.5 text-indigo-500" />
            <span>פרופיל לקוח</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] sm:w-[360px] p-0 overflow-y-auto bg-card" dir="rtl">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle className="text-sm font-bold flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-500" />
              פרופיל לקוח: {client.name}
            </SheetTitle>
          </SheetHeader>
          <SidebarInnerContent client={client} clientContext={clientContext} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
