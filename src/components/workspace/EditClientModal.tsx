'use client'

/**
 * src/components/workspace/EditClientModal.tsx
 *
 * Modal dialog for editing client details in Nehemiah OS v2.
 * Allows updating general details, contact info, advisory profile,
 * and specifically Google Drive Folder ID and Google Sheet ID.
 */

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  UserCog,
  FolderOpen,
  Table as TableIcon,
  Loader2,
  Check,
  Save,
  HelpCircle,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { updateClientDetailsAction, type UpdateClientDetailsInput } from '@/app/admin/crm/[id]/actions-workspace'
import { deleteClient } from '@/app/admin/crm/actions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface EditClientModalProps {
  client: {
    id: string
    name: string
    email: string | null
    phone: string | null
    address: string | null
    id_number: string | null
    status: string | null
    drive_folder_id: string | null
    google_sheet_id: string | null
    gmail_label?: string | null
    portfolio_value: number | null
    advisory_goal: string | null
    risk_level: string | null
  }
  triggerButton?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function EditClientModal({
  client,
  triggerButton,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: EditClientModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const setOpen = (newOpen: boolean) => {
    if (isControlled) {
      setControlledOpen?.(newOpen)
    } else {
      setInternalOpen(newOpen)
    }
  }

  const [deleting, setDeleting] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    const toastId = toast.loading(`מוחק את כל הנתונים של ${client.name}...`)
    try {
      const res = await deleteClient(client.id)
      if (res.error) {
        toast.error(res.error, { id: toastId })
      } else {
        toast.success(`הלקוח ${client.name} וכל המידע שלו נמחקו בהצלחה`, { id: toastId })
        setOpen(false)
        router.push('/admin/crm')
      }
    } catch (err: any) {
      toast.error(err.message || 'שגיאה במחיקה', { id: toastId })
    } finally {
      setDeleting(false)
    }
  }

  // Form states
  const [name, setName] = useState(client.name || '')
  const [email, setEmail] = useState(client.email || '')
  const [phone, setPhone] = useState(client.phone || '')
  const [address, setAddress] = useState(client.address || '')
  const [idNumber, setIdNumber] = useState(client.id_number || '')
  const [status, setStatus] = useState(client.status || 'active')
  const [driveFolderId, setDriveFolderId] = useState(client.drive_folder_id || '')
  const [googleSheetId, setGoogleSheetId] = useState(client.google_sheet_id || '')
  const [gmailLabel, setGmailLabel] = useState(client.gmail_label || '')
  const [portfolioValue, setPortfolioValue] = useState(
    client.portfolio_value ? String(client.portfolio_value) : ''
  )
  const [advisoryGoal, setAdvisoryGoal] = useState(client.advisory_goal || '')
  const [riskLevel, setRiskLevel] = useState(client.risk_level || '')

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setName(client.name || '')
      setEmail(client.email || '')
      setPhone(client.phone || '')
      setAddress(client.address || '')
      setIdNumber(client.id_number || '')
      setStatus(client.status || 'active')
      setDriveFolderId(client.drive_folder_id || '')
      setGoogleSheetId(client.google_sheet_id || '')
      setGmailLabel(client.gmail_label || '')
      setPortfolioValue(client.portfolio_value ? String(client.portfolio_value) : '')
      setAdvisoryGoal(client.advisory_goal || '')
      setRiskLevel(client.risk_level || '')
    }
    setOpen(newOpen)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('שם הלקוח הוא שדה חובה')
      return
    }

    startTransition(async () => {
      const input: UpdateClientDetailsInput = {
        name,
        email,
        phone,
        address,
        id_number: idNumber,
        status,
        drive_folder_id: driveFolderId,
        google_sheet_id: googleSheetId,
        gmail_label: gmailLabel,
        portfolio_value: portfolioValue ? parseFloat(portfolioValue.replace(/,/g, '')) : null,
        advisory_goal: advisoryGoal,
        risk_level: riskLevel,
      }

      const res = await updateClientDetailsAction(client.id, input)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('פרטי הלקוח עודכנו בהצלחה!')
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && triggerButton !== null && (
        <DialogTrigger asChild>
          {triggerButton || (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs font-semibold hover:bg-muted"
            >
              <UserCog className="w-3.5 h-3.5" />
              ערוך פרטי לקוח
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <UserCog className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">עריכת פרטי לקוח</DialogTitle>
              <DialogDescription className="text-xs">
                עדכון פרטי התקשרות, פרופיל ייעוצי וחיבורי Google Workspace
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Section 1: Basic Details */}
          <div className="space-y-3 p-3.5 bg-slate-50/70 rounded-xl border border-border/50">
            <h4 className="text-xs font-bold text-foreground">פרטים כלליים</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">שם הלקוח *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="שם מלא"
                  required
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">סטטוס</Label>
                <Select value={status} onValueChange={(val) => setStatus(val || 'active')}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">פעיל (Active)</SelectItem>
                    <SelectItem value="prospect">פוטנציאל (Prospect)</SelectItem>
                    <SelectItem value="inactive">לא פעיל (Inactive)</SelectItem>
                    <SelectItem value="archived">ארכיון (Archived)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">אימייל</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@example.com"
                  dir="ltr"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">טלפון</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="050-0000000"
                  dir="ltr"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">תעודת זהות / ח.פ</Label>
                <Input
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="מספר מזהה"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">כתובת</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="רחוב, עיר"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Google Workspace Identifiers */}
          <div className="space-y-3 p-3.5 bg-amber-50/40 rounded-xl border border-amber-200/70">
            <div className="flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-bold text-amber-900">Google Workspace (Drive & Sheets)</h4>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">
                    Google Drive Folder ID
                  </Label>
                  <span className="text-[10px] text-muted-foreground">ניתן להדביק קישור מלא או מזהה</span>
                </div>
                <Input
                  value={driveFolderId}
                  onChange={(e) => setDriveFolderId(e.target.value)}
                  placeholder="לדוגמה: 1637-B5lxNyPS181J8C4-mjnCjKH-Mbv4 או קישור מלא"
                  dir="ltr"
                  className="h-8 text-xs font-mono bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">
                    Google Sheets Spreadsheet ID
                  </Label>
                  <span className="text-[10px] text-muted-foreground">ניתן להדביק קישור מלא או מזהה</span>
                </div>
                <Input
                  value={googleSheetId}
                  onChange={(e) => setGoogleSheetId(e.target.value)}
                  placeholder="לדוגמה: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms או קישור מלא"
                  dir="ltr"
                  className="h-8 text-xs font-mono bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">
                    תווית אימייל ב-Gmail (Gmail Label)
                  </Label>
                  <span className="text-[10px] text-muted-foreground">לדוגמה: לקוחות/ישראל ישראלי</span>
                </div>
                <Input
                  value={gmailLabel}
                  onChange={(e) => setGmailLabel(e.target.value)}
                  placeholder="הקלד שם תווית ב-Gmail (או השאר ריק לחיפוש לפי אימייל)"
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Advisory Profile */}
          <div className="space-y-3 p-3.5 bg-slate-50/70 rounded-xl border border-border/50">
            <h4 className="text-xs font-bold text-foreground">פרופיל ייעוצי</h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">שווי תיק (₪)</Label>
                <Input
                  type="number"
                  value={portfolioValue}
                  onChange={(e) => setPortfolioValue(e.target.value)}
                  placeholder="0"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">רמת סיכון</Label>
                <Select value={riskLevel} onValueChange={(val) => setRiskLevel(val || '')}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="בחר סיכון" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="שמרני">שמרני</SelectItem>
                    <SelectItem value="מאוזן">מאוזן</SelectItem>
                    <SelectItem value="מוגבר">מוגבר</SelectItem>
                    <SelectItem value="ספקולטיבי">ספקולטיבי</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <Label className="text-xs">מטרת ייעוץ</Label>
                <Input
                  value={advisoryGoal}
                  onChange={(e) => setAdvisoryGoal(e.target.value)}
                  placeholder="לדוגמה: צמיחה והרחבת עסק, תכנון פרישה..."
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 flex flex-row items-center justify-between gap-2 border-t border-border/40 mt-2">
            <AlertDialog>
              <AlertDialogTrigger
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-colors border border-red-200"
                type="button"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                מחק לקוח וכל הנתונים
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>מחיקת לקוח וכל המידע לצמיתות</AlertDialogTitle>
                  <AlertDialogDescription>
                    האם אתה בטוח שברצונך למחוק את הלקוח <strong>{client.name}</strong>?
                    <br /><br />
                    פעולה זו היא <strong>בלתי הפיכה</strong> ותמחק לצמיתות את <strong>כל הנתונים</strong> המשויכים ללקוח במערכת:
                    משימות, פגישות, מסמכים, היסטוריית תיקים והגדרות דשבורד.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold"
                  >
                    כן, מחק את כל המידע לצמיתות
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isPending || deleting}
              >
                ביטול
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending || deleting}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 font-semibold"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isPending ? 'שומר שינויים...' : 'שמור פרטים'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
