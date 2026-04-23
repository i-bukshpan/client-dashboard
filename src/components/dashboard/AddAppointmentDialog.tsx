'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarClock, Loader2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const schema = z.object({
  title: z.string().min(2, 'נדרש שם פגישה'),
  start_time: z.string().min(1, 'נדרש זמן התחלה'),
  end_time: z.string().min(1, 'נדרש זמן סיום'),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props { open: boolean; onClose: () => void }

export function AddAppointmentDialog({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('לא נמצא משתמש מחובר. נסה לרענן את העמוד.')
      }

      const { error } = await (supabase.from('appointments') as any).insert({
        title: data.title,
        start_time: data.start_time,
        end_time: data.end_time,
        notes: data.notes,
        status: 'scheduled',
        employee_id: user.id, // Set employee to the current user
      })

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(error.message || 'שגיאה בשמירת הפגישה במסד הנתונים')
      }

      toast.success('הפגישה נוצרה בהצלחה')
      reset()
      onClose()
      window.location.reload()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'אירעה שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 border-l-slate-200" side="right">
        <div className="p-6 pb-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
          <SheetHeader>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2 shadow-sm border border-blue-200">
              <CalendarClock className="w-5 h-5 text-blue-700" />
            </div>
            <SheetTitle className="text-xl font-bold text-slate-900">קביעת פגישה חדשה</SheetTitle>
            <SheetDescription className="text-slate-500 text-sm">
              הזן את פרטי הפגישה. זימון ישלח למשתתפים במידה ורלוונטי.
            </SheetDescription>
          </SheetHeader>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">נושא הפגישה <span className="text-red-500">*</span></Label>
            <Input 
              className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white" 
              placeholder="לדוגמה: פגישת ייעוץ ראשונית" 
              {...register('title')} 
            />
            {errors.title && <p className="text-red-500 text-xs font-medium">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">שעת התחלה <span className="text-red-500">*</span></Label>
              <Input 
                type="datetime-local" 
                dir="ltr" 
                className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white" 
                {...register('start_time')} 
              />
              {errors.start_time && <p className="text-red-500 text-xs font-medium">{errors.start_time.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">שעת סיום <span className="text-red-500">*</span></Label>
              <Input 
                type="datetime-local" 
                dir="ltr" 
                className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white" 
                {...register('end_time')} 
              />
              {errors.end_time && <p className="text-red-500 text-xs font-medium">{errors.end_time.message}</p>}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-100 pb-8">
            <Button type="submit" disabled={loading} className="w-full h-11 gap-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-sm font-medium transition-all active:scale-[0.98]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {loading ? 'שומר פגישה...' : 'שמור פגישה'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}




