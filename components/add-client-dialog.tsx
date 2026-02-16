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
import { Plus } from 'lucide-react'

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
    if (!name) return

    try {
      setLoading(true)
      setError(null)
      await onAddClient(
        name,
        email || null,
        phone || null,
        status
      )
      // Reset form
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
        <Button className="gap-2" data-add-client-trigger>
          <Plus className="h-4 w-4" />
          הוסף לקוח חדש
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>הוסף לקוח חדש</DialogTitle>
          <DialogDescription>
            הזן את פרטי הלקוח
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">שם הלקוח</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: יוסי כהן"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">אימייל (אופציונלי)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">טלפון (אופציונלי)</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">סטטוס</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                required
              >
                <option value="פעיל">פעיל</option>
                <option value="ליד">ליד</option>
                <option value="ארכיון">ארכיון</option>
              </select>
            </div>
          </div>
          {error && (
            <div className="text-red-500 text-sm mt-2">{error}</div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
                setError(null)
                setName('')
                setEmail('')
                setPhone('')
                setStatus('פעיל')
              }}
              disabled={loading}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'מוסיף...' : 'הוסף'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
