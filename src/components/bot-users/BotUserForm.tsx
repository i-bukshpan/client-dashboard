'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export type BotContact = {
  id: string
  name: string | null
  phone: string
  user_type: string
  is_active: boolean
}

interface BotUserFormProps {
  initialData?: BotContact | null
  onSubmit: (data: { name: string, phone: string, user_type: string, is_active: boolean }) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function BotUserForm({ initialData, onSubmit, onCancel, isLoading }: BotUserFormProps) {
  const [name, setName] = useState(initialData?.name || '')
  const [phone, setPhone] = useState(initialData?.phone || '')
  const [userType, setUserType] = useState(initialData?.user_type || 'worker')
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit({ name, phone, user_type: userType, is_active: isActive })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">שם משתמש (לתצוגה)</Label>
        <Input 
          id="name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          required 
          placeholder="לדוגמה: ישראל ישראלי" 
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">מספר טלפון (וואטסאפ)</Label>
        <Input 
          id="phone" 
          value={phone} 
          onChange={(e) => setPhone(e.target.value)} 
          required 
          placeholder="0501234567" 
          dir="ltr"
        />
        <p className="text-xs text-muted-foreground">יומר אוטומטית לפורמט 972...</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="userType">סוג הרשאה (תפקיד)</Label>
        <Select value={userType} onValueChange={setUserType}>
          <SelectTrigger dir="rtl">
            <SelectValue placeholder="בחר תפקיד" />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="admin">מנהל ראשי (admin)</SelectItem>
            <SelectItem value="moshe_admin">מנהל פורטל (moshe_admin)</SelectItem>
            <SelectItem value="worker">עובד שטח (worker)</SelectItem>
            <SelectItem value="partner">שותף פרויקט (partner)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between space-x-2 space-x-reverse pt-2 border-t mt-4">
        <Label htmlFor="isActive" className="cursor-pointer">משתמש פעיל (מורשה להשתמש בבוט)</Label>
        <Switch 
          id="isActive" 
          checked={isActive} 
          onCheckedChange={setIsActive} 
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          ביטול
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'שומר...' : (initialData ? 'עדכן משתמש' : 'הוסף משתמש')}
        </Button>
      </div>
    </form>
  )
}
