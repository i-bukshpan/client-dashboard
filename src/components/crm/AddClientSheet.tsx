'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Plus, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createClientFolder } from '@/lib/google-drive'

const schema = z.object({
  name: z.string().min(2, 'שם מלא נדרש'),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')),
  phone: z.string().optional(),
  id_number: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export function AddClientSheet() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Create Drive folder
    let drive_folder_id: string | null = null
    try {
      drive_folder_id = await createClientFolder(data.name)
    } catch { /* fallback gracefully */ }

    await (supabase.from('clients') as any).insert({
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      id_number: data.id_number || null,
      address: data.address || null,
      notes: data.notes || null,
      drive_folder_id,
      created_by: user!.id,
    })

    setLoading(false)
    reset()
    setOpen(false)
    window.location.reload()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          הוסף לקוח
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" side="right">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            לקוח חדש
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>שם מלא *</Label>
            <Input placeholder="ישראל ישראלי" {...register('name')} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>אימייל</Label>
              <Input type="email" dir="ltr" placeholder="mail@example.com" {...register('email')} />
              {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>טלפון</Label>
              <Input type="tel" dir="ltr" placeholder="050-0000000" {...register('phone')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>תעודת זהות</Label>
            <Input dir="ltr" placeholder="000000000" {...register('id_number')} />
          </div>
          <div className="space-y-2">
            <Label>כתובת</Label>
            <Input placeholder="רחוב, עיר" {...register('address')} />
          </div>
          <div className="space-y-2">
            <Label>הערות</Label>
            <Textarea placeholder="מידע נוסף על הלקוח..." {...register('notes')} />
          </div>

          <div className="pt-4 border-t">
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {loading ? 'יוצר לקוח ותיקיית Drive...' : 'צור לקוח'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}



