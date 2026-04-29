'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Loader2, Save, UserCog, Mail, Phone, IdCard, MapPin, TrendingUp, Target, Calendar, DollarSign } from 'lucide-react'
import { updateClient } from '@/app/admin/crm/actions'
import { toast } from 'sonner'
import type { Client } from '@/types/database'
import { useRouter } from 'next/navigation'

const schema = z.object({
  name: z.string().min(2, 'שם מלא נדרש'),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')),
  phone: z.string().optional(),
  id_number: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  birth_date: z.string().optional(),
  portfolio_value: z.string().optional(),
  client_since: z.string().optional(),
  meeting_frequency: z.string().optional(),
  risk_level: z.string().optional(),
  advisory_goal: z.string().optional(),
  advisory_track: z.string().optional(),
  status: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  client: Client
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditClientSheet({ client, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: client.name ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      id_number: client.id_number ?? '',
      address: client.address ?? '',
      notes: client.notes ?? '',
      birth_date: client.birth_date ?? '',
      portfolio_value: client.portfolio_value?.toString() ?? '',
      client_since: client.client_since ?? '',
      meeting_frequency: client.meeting_frequency ?? '',
      risk_level: client.risk_level ?? '',
      advisory_goal: client.advisory_goal ?? '',
      advisory_track: client.advisory_track ?? '',
      status: client.status ?? 'active',
    },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const result = await updateClient(client.id, {
        ...data,
        email: data.email || null,
        portfolio_value: data.portfolio_value ? parseFloat(data.portfolio_value) : null,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('פרטי הלקוח עודכנו בהצלחה')
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error('אירעה שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0 border-l-slate-200" side="right">
        <div className="p-6 pb-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
          <SheetHeader>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2 shadow-sm border border-blue-200">
              <UserCog className="w-5 h-5 text-blue-700" />
            </div>
            <SheetTitle className="text-xl font-bold text-slate-900">עריכת לקוח</SheetTitle>
            <SheetDescription className="text-slate-500 text-sm">
              עדכן את פרטי הלקוח {client.name}
            </SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">

          {/* פרטים בסיסיים */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">פרטים אישיים</p>

            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">שם מלא <span className="text-red-500">*</span></Label>
              <Input className="h-10 border-slate-200 rounded-lg bg-white" placeholder="ישראל ישראלי" {...register('name')} />
              {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">אימייל</Label>
                <div className="relative">
                  <Input type="email" dir="ltr" className="h-10 border-slate-200 rounded-lg bg-white pl-10" placeholder="mail@example.com" {...register('email')} />
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
                {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">טלפון</Label>
                <div className="relative">
                  <Input type="tel" dir="ltr" className="h-10 border-slate-200 rounded-lg bg-white pl-10" placeholder="050-0000000" {...register('phone')} />
                  <Phone className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">תעודת זהות / ח.פ</Label>
                <div className="relative">
                  <Input dir="ltr" className="h-10 border-slate-200 rounded-lg bg-white pl-10" placeholder="000000000" {...register('id_number')} />
                  <IdCard className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">תאריך לידה</Label>
                <div className="relative">
                  <Input type="date" className="h-10 border-slate-200 rounded-lg bg-white pl-10" {...register('birth_date')} />
                  <Calendar className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">כתובת מגורים / עסק</Label>
              <div className="relative">
                <Input className="h-10 border-slate-200 rounded-lg bg-white pr-10" placeholder="רחוב, עיר" {...register('address')} />
                <MapPin className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          <Separator />

          {/* פרטי ייעוץ */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">פרטי ייעוץ</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">לקוח מאז</Label>
                <div className="relative">
                  <Input type="date" className="h-10 border-slate-200 rounded-lg bg-white pl-10" {...register('client_since')} />
                  <Calendar className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">שווי תיק (₪)</Label>
                <div className="relative">
                  <Input type="number" dir="ltr" className="h-10 border-slate-200 rounded-lg bg-white pl-10" placeholder="0" {...register('portfolio_value')} />
                  <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">רמת סיכון</Label>
                <Select defaultValue={(watch('risk_level') ?? '') as string} onValueChange={v => setValue('risk_level', v ?? undefined)}>
                  <SelectTrigger className="h-10 border-slate-200 rounded-lg bg-white">
                    <SelectValue>
                      {({ low: 'נמוך', medium: 'בינוני', high: 'גבוה', very_high: 'גבוה מאוד' } as any)[watch('risk_level') ?? ''] ?? 'בחר רמת סיכון'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">נמוך</SelectItem>
                    <SelectItem value="medium">בינוני</SelectItem>
                    <SelectItem value="high">גבוה</SelectItem>
                    <SelectItem value="very_high">גבוה מאוד</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">תדירות פגישות</Label>
                <Select defaultValue={(watch('meeting_frequency') ?? '') as string} onValueChange={v => setValue('meeting_frequency', v ?? undefined)}>
                  <SelectTrigger className="h-10 border-slate-200 rounded-lg bg-white">
                    <SelectValue>
                      {({ weekly: 'שבועי', biweekly: 'דו-שבועי', monthly: 'חודשי', quarterly: 'רבעוני', annually: 'שנתי' } as any)[watch('meeting_frequency') ?? ''] ?? 'בחר תדירות'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">שבועי</SelectItem>
                    <SelectItem value="biweekly">דו-שבועי</SelectItem>
                    <SelectItem value="monthly">חודשי</SelectItem>
                    <SelectItem value="quarterly">רבעוני</SelectItem>
                    <SelectItem value="annually">שנתי</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">מסלול ייעוץ</Label>
              <div className="relative">
                <Input className="h-10 border-slate-200 rounded-lg bg-white pr-10" placeholder="לדוגמה: ייעוץ פנסיוני" {...register('advisory_track')} />
                <TrendingUp className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">יעד ייעוצי</Label>
              <div className="relative">
                <Input className="h-10 border-slate-200 rounded-lg bg-white pr-10" placeholder="לדוגמה: פרישה בגיל 65" {...register('advisory_goal')} />
                <Target className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">סטטוס לקוח</Label>
              <Select defaultValue={(watch('status') ?? 'active') as string} onValueChange={v => setValue('status', v ?? undefined)}>
                <SelectTrigger className="h-10 border-slate-200 rounded-lg bg-white">
                  <SelectValue>
                    {({ active: 'פעיל', inactive: 'לא פעיל', prospect: 'פוטנציאל', archived: 'ארכיון' } as any)[watch('status') ?? ''] ?? 'בחר סטטוס'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">פעיל</SelectItem>
                  <SelectItem value="inactive">לא פעיל</SelectItem>
                  <SelectItem value="prospect">פוטנציאל</SelectItem>
                  <SelectItem value="archived">ארכיון</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* הערות */}
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">הערות</Label>
            <Textarea className="min-h-[100px] border-slate-200 rounded-lg bg-white resize-y" placeholder="מידע נוסף, רגישויות, פרטים טכניים..." {...register('notes')} />
          </div>

          <div className="pt-4 border-t border-slate-100 pb-4">
            <Button type="submit" className="w-full h-11 gap-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-sm font-medium" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {loading ? 'שומר שינויים...' : 'שמור שינויים'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
