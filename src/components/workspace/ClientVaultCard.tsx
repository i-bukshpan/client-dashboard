'use client'

import React, { useState } from 'react'
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Plus,
  Trash2,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import type { ClientVaultItem } from '@/lib/v2/client-ecosystem-dal'
import {
  saveClientVaultItemAction,
  revealClientVaultSecretAction,
  deleteClientVaultItemAction,
} from '@/app/workspace/actions/client-ecosystem'

interface ClientVaultCardProps {
  clientId: string
  clientName: string
  initialItems: ClientVaultItem[]
}

export function ClientVaultCard({
  clientId,
  clientName,
  initialItems = [],
}: ClientVaultCardProps) {
  const [items, setItems] = useState<ClientVaultItem[]>(initialItems)
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({})
  const [loadingSecretId, setLoadingSecretId] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [institutionName, setInstitutionName] = useState('')
  const [accountIdentifier, setAccountIdentifier] = useState('')
  const [username, setUsername] = useState('')
  const [secret, setSecret] = useState('')
  const [portalUrl, setPortalUrl] = useState('')
  const [notes, setNotes] = useState('')

  const handleToggleReveal = async (id: string) => {
    if (revealedSecrets[id]) {
      // Hide
      setRevealedSecrets((prev) => {
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
      return
    }

    setLoadingSecretId(id)
    try {
      const res = await revealClientVaultSecretAction(id, clientId)
      if (res.success && res.secret) {
        setRevealedSecrets((prev) => ({ ...prev, [id]: res.secret! }))
        // Auto-hide after 30 seconds for FAANG-level security
        setTimeout(() => {
          setRevealedSecrets((prev) => {
            const copy = { ...prev }
            delete copy[id]
            return copy
          })
        }, 30000)
      } else {
        toast.error(res.error || 'חשיפת הסיסמה נכשלה')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoadingSecretId(null)
    }
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} הועתק ללוח`)
  }

  const handleSaveItem = async () => {
    if (!institutionName.trim() || !username.trim() || !secret.trim()) {
      toast.error('נא למלא שם מוסד, שם משתמש וסיסמה')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await saveClientVaultItemAction({
        clientId,
        institutionName: institutionName.trim(),
        accountIdentifier: accountIdentifier.trim() || undefined,
        username: username.trim(),
        secret: secret.trim(),
        portalUrl: portalUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      })

      if (res.success && res.item) {
        setItems((prev) => [...prev, res.item!])
        toast.success(`פרטי הגישה ל-${institutionName} נשמרו בהצלחה בהצפנה מלאה`)
        setIsOpen(false)
        setInstitutionName('')
        setAccountIdentifier('')
        setUsername('')
        setSecret('')
        setPortalUrl('')
        setNotes('')
      } else {
        toast.error(res.error || 'שמירת הפריט נכשלה')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`האם למחוק את פרטי הגישה ל-${name} לצמיתות?`)) return

    try {
      const res = await deleteClientVaultItemAction(id, clientId)
      if (res.success) {
        setItems((prev) => prev.filter((i) => i.id !== id))
        toast.success('פריט הכספת נמחק בהצלחה')
      } else {
        toast.error(res.error || 'שגיאה במחיקת פריט')
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card/60 p-4 rounded-xl border border-border">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            כספת פרטי גישה פיננסיים מוצפנת ({clientName})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            פרטי כניסה מאובטחים לבנקים, רשויות מס, רואי חשבון ופורטלים (מוצפן AES-256)
          </p>
        </div>
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 gap-1.5"
        >
          <Plus className="w-4 h-4" />
          הוסף גישה לכספת
        </Button>
      </div>

      {/* Vault Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const isRevealed = Boolean(revealedSecrets[item.id])
          const secretValue = revealedSecrets[item.id] || '••••••••••••'

          return (
            <Card key={item.id} className="border-border bg-card/50 backdrop-blur-xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground leading-tight">
                        {item.institutionName}
                      </h4>
                      {item.accountIdentifier && (
                        <span className="text-[11px] text-muted-foreground font-mono" dir="ltr">
                          ח-ן / סניף: {item.accountIdentifier}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    מוצפן
                  </Badge>
                </div>

                {/* Credentials block */}
                <div className="space-y-2 bg-secondary/40 p-3 rounded-lg border border-border/50 text-xs">
                  {/* Username */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">משתמש:</span>
                    <div className="flex items-center gap-1.5 font-mono font-medium">
                      <span dir="ltr">{item.username}</span>
                      <button
                        onClick={() => handleCopy(item.username, 'שם המשתמש')}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        title="העתק שם משתמש"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Secret / Password */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">סיסמה:</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span dir="ltr" className={isRevealed ? 'text-indigo-300 font-semibold' : 'text-muted-foreground'}>
                        {secretValue}
                      </span>
                      <button
                        onClick={() => handleToggleReveal(item.id)}
                        disabled={loadingSecretId === item.id}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        title={isRevealed ? 'הסתר סיסמה' : 'הצג סיסמה'}
                      >
                        {isRevealed ? <EyeOff className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3" />}
                      </button>
                      {isRevealed && (
                        <button
                          onClick={() => handleCopy(revealedSecrets[item.id], 'הסיסמה')}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title="העתק סיסמה"
                        >
                          <Copy className="w-3 h-3 text-emerald-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {item.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.notes}
                  </p>
                )}

                {/* Actions footer */}
                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                  {item.portalUrl ? (
                    <a
                      href={item.portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      כניסה לפורטל
                    </a>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">ללא כתובת פורטל</span>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-400"
                    onClick={() => handleDelete(item.id, item.institutionName)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {items.length === 0 && (
          <div className="col-span-full text-center py-10 bg-card/20 rounded-xl border border-dashed border-border p-6">
            <Lock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">הכספת ריקה עבור לקוח זה</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              הזן פרטי גישה לבנקים (הפועלים, לאומי וכו&apos;), מע&quot;מ או רואה חשבון. כל המידע מוצפן ברמת השרת ואינו חשוף לגורמים זרים.
            </p>
          </div>
        )}
      </div>

      {/* Add Vault Item Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[440px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת פרטי כניסה לכספת המאובטחת</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label>שם המוסד / השירות</Label>
              <Input
                placeholder="למשל: בנק לאומי / בנק הפועלים / פורטל מע&quot;מ"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>מספר חשבון / סניף / מזהה (אופציונלי)</Label>
              <Input
                placeholder="סניף 654 ח-ן 123456"
                dir="ltr"
                value={accountIdentifier}
                onChange={(e) => setAccountIdentifier(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>שם משתמש / קוד מנוי</Label>
                <Input
                  placeholder="username"
                  dir="ltr"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>סיסמה</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  dir="ltr"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>קישור כניסה לפורטל (אופציונלי)</Label>
              <Input
                placeholder="https://hb.bankhapoalim.co.il"
                dir="ltr"
                value={portalUrl}
                onChange={(e) => setPortalUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>הערות התחברות (קוד אימות, שאלת אבטחה וכו&apos;)</Label>
              <Input
                placeholder="למשל: קוד OTP נשלח למספר של דודי"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
              ביטול
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSubmitting ? 'שומר בהצפנה...' : 'שמור בכספת'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
