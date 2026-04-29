'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Loader2, Plus, UserPlus, Mail, Phone, IdCard, MapPin } from 'lucide-react'
import { createClientFolder } from '@/lib/google-drive'
import { createClientAction } from '@/app/admin/crm/create-client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      let drive_folder_id: string | null = null
      try {
        drive_folder_id = await createClientFolder(data.name)
      } catch { /* fallback gracefully */ }

      const result = await createClientAction({ ...data, drive_folder_id })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('הלקוח נוצר בהצלחה')
      reset()
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'אירעה שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={cn(buttonVariants({ variant: 'default' }), "gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-sm rounded-lg")}>
        <UserPlus className="w-4 h-4" />
        הוסף לקוח
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 border-l-slate-200" side="right">
        <div className="p-6 pb-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
          <SheetHeader>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2 shadow-sm border border-blue-200">
              <UserPlus className="w-5 h-5 text-blue-700" />
            </div>
            <SheetTitle className="text-xl font-bold text-slate-900">יצירת לקוח חדש</SheetTitle>
            <SheetDescription className="text-slate-500 text-sm">
              הזן את פרטי הלקוח. ניתן להשלים פרטי ייעוץ מדף הפרופיל לאחר היצירה.
            </SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">שם מלא <span className="text-red-500">*</span></Label>
            <Input
              className="h-10 border-slate-200 focus:border-slate-400 rounded-lg bg-white"
              placeholder="ישראל ישראלי"
              {...register('name')}
            />
            {errors.name && <p className="text-red-500 text-xs font-medium">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">אימייל</Label>
              <div className="relative">
                <Input
                  type="email"
                  dir="ltr"
                  className="h-10 border-slate-200 rounded-lg bg-white pl-10"
                  placeholder="mail@example.com"
                  {...register('email')}
                />
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
              {errors.email && <p className="text-red-500 text-xs font-medium">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">טלפון</Label>
              <div className="relative">
                <Input
                  type="tel"
                  dir="ltr"
                  className="h-10 border-slate-200 rounded-lg bg-white pl-10"
                  placeholder="050-0000000"
                  {...register('phone')}
                />
                <Phone className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">תעודת זהות / ח.פ</Label>
            <div className="relative">
              <Input
                dir="ltr"
                className="h-10 border-slate-200 rounded-lg bg-white pl-10"
                placeholder="000000000"
                {...register('id_number')}
              />
              <IdCard className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">כתובת מגורים / עסק</Label>
            <div className="relative">
              <Input
                className="h-10 border-slate-200 rounded-lg bg-white pr-10"
                placeholder="רחוב, עיר"
                {...register('address')}
              />
              <MapPin className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">הערות</Label>
            <Textarea
              className="min-h-[100px] border-slate-200 rounded-lg bg-white resize-y"
              placeholder="מידע נוסף, רגישויות, פרטים טכניים..."
              {...register('notes')}
            />
          </div>

          <div className="pt-6 mt-6 border-t border-slate-100 pb-8">
            <Button
              type="submit"
              className="w-full h-11 gap-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-sm font-medium"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {loading ? 'שומר נתונים...' : 'צור לקוח חדש'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
