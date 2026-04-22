'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Save } from 'lucide-react'
import type { Client } from '@/types/database'

export function ClientProfile({ client }: { client: Client }) {
  const [form, setForm] = useState({ ...client })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setLoading(true)
    const supabase = createClient()
    await (supabase.from('clients') as any).update({
      name: form.name,
      email: form.email,
      phone: form.phone,
      id_number: form.id_number,
      address: form.address,
      notes: form.notes,
    }).eq('id', client.id)
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function field(label: string, key: keyof Client, dir?: string, type?: string) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Input
          type={type ?? 'text'}
          dir={dir}
          value={(form[key] as string) ?? ''}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      </div>
    )
  }

  return (
    <Card className="border-border/50">
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('שם מלא', 'name')}
          {field('תעודת זהות', 'id_number', 'ltr')}
          {field('אימייל', 'email', 'ltr', 'email')}
          {field('טלפון', 'phone', 'ltr', 'tel')}
        </div>
        {field('כתובת', 'address')}
        <div className="space-y-2">
          <Label>הערות</Label>
          <Textarea
            value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="min-h-[80px]"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'נשמר!' : 'שמור שינויים'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

