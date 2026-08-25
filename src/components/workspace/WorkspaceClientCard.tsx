'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FolderOpen,
  TableIcon,
  ChevronLeft,
  Pencil,
  Trash2,
  Loader2,
  LayoutGrid,
  Brain,
} from 'lucide-react'
import { EditClientModal } from './EditClientModal'
import { deleteClient } from '@/app/admin/crm/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
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

interface Props {
  client: any
}

export function WorkspaceClientCard({ client }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const hasSheet = !!client.google_sheet_id
  const hasDrive = !!client.drive_folder_id
  const hasDashboard = client.dashboard_config_json?.widgets?.length > 0
  const hasContext = !!(client.client_context_json && typeof client.client_context_json === 'object' && 'version' in client.client_context_json)
  const initials = (client.name as string)
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  async function handleDelete() {
    setDeleting(true)
    const toastId = toast.loading(`מוחק את כל הנתונים של ${client.name}...`)
    try {
      const res = await deleteClient(client.id)
      if (res.error) {
        toast.error(res.error, { id: toastId })
      } else {
        toast.success(`הלקוח ${client.name} וכל המידע שלו נמחקו בהצלחה`, { id: toastId })
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err.message || 'שגיאה במחיקה', { id: toastId })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="bg-card border border-border/60 rounded-2xl p-4 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 group relative">
        <div className="flex items-start gap-3">
          <Link href={`/workspace/clients/${client.id}`} className="shrink-0">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/workspace/clients/${client.id}`}
                className="font-bold text-foreground text-sm truncate hover:text-primary transition-colors block"
              >
                {client.name}
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 hover:text-blue-600 text-muted-foreground"
                  onClick={() => setEditOpen(true)}
                  title="ערוך פרטי לקוח"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger
                    className="w-7 h-7 rounded-lg inline-flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 text-muted-foreground"
                    title="מחק לקוח וכל הנתונים לצמיתות"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {deleting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>מחיקת לקוח וכל המידע לצמיתות</AlertDialogTitle>
                      <AlertDialogDescription>
                        האם אתה בטוח שברצונך למחוק את הלקוח <strong>{client.name}</strong>?
                        <br />
                        <br />
                        פעולה זו <strong>בלתי הפיכה</strong> ותמחק לצמיתות את <strong>כל הנתונים</strong> המשויכים ללקוח במערכת:
                        משימות, פגישות, מסמכים, היסטוריה ודשבורד.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ביטול</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold"
                      >
                        כן, מחק את כל המידע
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Link
                  href={`/workspace/clients/${client.id}`}
                  className="w-7 h-7 inline-flex items-center justify-center text-muted-foreground/40 hover:text-primary transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {client.email && (
              <p className="text-xs text-muted-foreground truncate mt-0.5" dir="ltr">
                {client.email}
              </p>
            )}

            {/* Workspace status badges */}
            <Link href={`/workspace/clients/${client.id}`} className="block">
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-[10px] gap-1 ${
                    hasDrive
                      ? 'text-amber-600 border-amber-200 bg-amber-50'
                      : 'text-muted-foreground/50 border-dashed'
                  }`}
                >
                  <FolderOpen className="w-2.5 h-2.5" />
                  Drive
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] gap-1 ${
                    hasSheet
                      ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
                      : 'text-muted-foreground/50 border-dashed'
                  }`}
                >
                  <TableIcon className="w-2.5 h-2.5" />
                  Sheets
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] gap-1 ${
                    hasDashboard
                      ? 'text-indigo-600 border-indigo-200 bg-indigo-50'
                      : 'text-muted-foreground/50 border-dashed'
                  }`}
                >
                  <LayoutGrid className="w-2.5 h-2.5" />
                  Dashboard
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] gap-1 ${
                    hasContext
                      ? 'text-violet-600 border-violet-200 bg-violet-50'
                      : 'text-amber-600 border-amber-300 bg-amber-50 animate-pulse'
                  }`}
                  title={hasContext ? 'הסוכן מכיר את הלקוח' : 'אפיון ראשוני טרם הושלם'}
                >
                  <Brain className="w-2.5 h-2.5" />
                  {hasContext ? 'מאופיין' : 'ממתין לאפיון'}
                </Badge>
              </div>
            </Link>
          </div>
        </div>
      </div>

      <EditClientModal
        client={client}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  )
}
