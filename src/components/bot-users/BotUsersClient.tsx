'use client'

import { useState } from 'react'
import { BotContact } from './BotUserForm'
import { BotUserForm } from './BotUserForm'
import { Button } from '@/components/ui/button'
import { Plus, Edit, Trash2, Bot, Phone } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { addBotContact, updateBotContact, deleteBotContact } from '@/app/admin/bot-users/actions'

interface BotUsersClientProps {
  contacts: BotContact[]
}

const roleMap: Record<string, string> = {
  admin: 'מנהל ראשי',
  moshe_admin: 'מנהל פורטל (משה)',
  worker: 'עובד שטח',
  partner: 'שותף פרויקט'
}

const roleBadgeColor: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 border-red-200',
  moshe_admin: 'bg-purple-100 text-purple-800 border-purple-200',
  worker: 'bg-blue-100 text-blue-800 border-blue-200',
  partner: 'bg-green-100 text-green-800 border-green-200'
}

export function BotUsersClient({ contacts }: BotUsersClientProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<BotContact | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleOpenAdd = () => {
    setEditingContact(null)
    setIsOpen(true)
  }

  const handleOpenEdit = (contact: BotContact) => {
    setEditingContact(contact)
    setIsOpen(true)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הרשאות הבוט של ${name || 'משתמש זה'}?`)) {
      return
    }

    try {
      const res = await deleteBotContact(id)
      if (res.error) throw new Error(res.error)
      toast.success('המשתמש נמחק בהצלחה')
    } catch (err: any) {
      toast.error('שגיאה במחיקת המשתמש: ' + err.message)
    }
  }

  const handleSubmit = async (data: { name: string, phone: string, user_type: string, is_active: boolean }) => {
    setIsLoading(true)
    try {
      let res;
      if (editingContact) {
        res = await updateBotContact(editingContact.id, data)
      } else {
        res = await addBotContact(data)
      }

      if (res.error) throw new Error(res.error)
      
      toast.success(editingContact ? 'המשתמש עודכן בהצלחה' : 'משתמש חדש הוסף בהצלחה')
      setIsOpen(false)
    } catch (err: any) {
      toast.error('שגיאה בשמירת הנתונים: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-blue-600" />
            הרשאות בוט חריגות
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            ניהול הרשאות לשימוש בבוט (וואטסאפ) למשתמשים שאינם חלק מרשימת עובדי הפורטל או השותפים הרגילים.
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          הוסף משתמש
        </Button>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <Table dir="rtl">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">שם</TableHead>
              <TableHead className="text-right">טלפון</TableHead>
              <TableHead className="text-right">תפקיד / הרשאה</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="text-center w-[120px]">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  לא נמצאו הרשאות מיוחדות בטבלה.
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">
                    {contact.name || '—'}
                  </TableCell>
                  <TableCell dir="ltr" className="text-right font-mono text-sm">
                    <div className="flex items-center justify-end gap-2">
                      {contact.phone}
                      <Phone className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={roleBadgeColor[contact.user_type] || ''}>
                      {roleMap[contact.user_type] || contact.user_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {contact.is_active ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">פעיל</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-500">לא פעיל</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(contact)}>
                        <Edit className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(contact.id, contact.name || contact.phone)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent dir="rtl" className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'עריכת משתמש בוט' : 'הוספת משתמש בוט חדש'}</DialogTitle>
          </DialogHeader>
          <BotUserForm 
            initialData={editingContact}
            onSubmit={handleSubmit}
            onCancel={() => setIsOpen(false)}
            isLoading={isLoading}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
