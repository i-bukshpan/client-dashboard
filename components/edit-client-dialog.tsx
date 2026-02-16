'use client'

import { useState, useEffect } from 'react'
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
import { Edit } from 'lucide-react'
import { supabase, type Client } from '@/lib/supabase'

interface EditClientDialogProps {
  client: Client
  onUpdate: () => void
}

export function EditClientDialog({ client, onUpdate }: EditClientDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(client.name)
  const [email, setEmail] = useState(client.email || '')
  const [phone, setPhone] = useState(client.phone || '')
  const [status, setStatus] = useState(client.status || 'פעיל')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update form when client changes
  useEffect(() => {
    if (client) {
      setName(client.name)
      setEmail(client.email || '')
      setPhone(client.phone || '')
      setStatus(client.status || 'פעיל')
    }
  }, [client])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return

    try {
      setLoading(true)
      setError(null)

      const { error: updateError } = await supabase
        .from('clients')
        .update({
          name,
          email: email || null,
          phone: phone || null,
          status: status || 'פעיל',
          updated_at: new Date().toISOString(),
        })
        .eq('id', client.id)

      if (updateError) {
        throw updateError
      }

      setOpen(false)
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון הלקוח')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Edit className="h-4 w-4" />
          ערוך לקוח
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ערוך לקוח</DialogTitle>
          <DialogDescription>
            עדכן את פרטי הלקוח
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">שם הלקוח</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: יוסי כהן"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">אימייל (אופציונלי)</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">טלפון (אופציונלי)</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">סטטוס</Label>
              <select
                id="edit-status"
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
                // Reset to original values
                setName(client.name)
                setEmail(client.email || '')
                setPhone(client.phone || '')
                setStatus(client.status || 'פעיל')
              }}
              disabled={loading}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'שומר...' : 'שמור שינויים'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
