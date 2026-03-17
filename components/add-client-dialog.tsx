'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserPlus } from 'lucide-react'

interface AddClientDialogProps {
  onAddClient: (
    name: string,
    email: string | null,
    phone: string | null,
    status: string
  ) => Promise<void>
}

export function AddClientDialog({ onAddClient }: AddClientDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('פעיל')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      setLoading(true)
      setError(null)
      await onAddClient(
        name.trim(),
        email.trim() || null,
        phone.trim() || null,
        status || 'פעיל'
      )
      setName('')
      setEmail('')
      setPhone('')
      setStatus('פעיל')
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בהוספת הלקוח')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl bg-primary hover:bg-primary/90 text-white font-bold gap-2 h-10 px-4 shadow-lg shadow-primary/20 text-xs" data-add-client-trigger>
          <UserPlus className="h-3.5 w-3.5" />
          לקוח חדש
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-md rounded-[2rem] p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-navy">הוספת לקוח חדש</DialogTitle>
          <DialogDescription>הזן את פרטי הלקוח היסודיים כדי להתחיל</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="font-bold">שם הלקוח</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: יוסי כהן"
              required
              className="rounded-xl h-11"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="font-bold">טלפון (אופציונלי)</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status" className="font-bold">סטטוס</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="פעיל">🟢 פעיל</SelectItem>
                  <SelectItem value="ליד">🔵 ליד</SelectItem>
                  <SelectItem value="ארכיון">📁 ארכיון</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="font-bold">אימייל (אופציונלי)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              className="rounded-xl h-11"
            />
          </div>

          {error && (
            <div className="text-red-500 text-xs font-bold mt-2 bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>
          )}

          <DialogFooter className="gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); setError(null) }}
              disabled={loading}
              className="rounded-xl h-11 px-6"
            >
              ביטול
            </Button>
            <Button type="submit" disabled={loading || !name.trim()} className="rounded-xl h-11 px-8 shadow-lg shadow-primary/20 font-bold bg-navy text-white hover:bg-navy/90">
              {loading ? 'מוסיף...' : 'צור לקוח'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
