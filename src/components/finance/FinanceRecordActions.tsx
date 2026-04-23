'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Trash2, Edit3, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Props {
  id: string
  type: 'income' | 'expenses'
}

export function FinanceRecordActions({ id, type }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('האם אתה בטוח שברצונך למחוק רשומה זו?')) return
    
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from(type).delete().eq('id', id)
      
      if (error) throw error
      toast.success('הרשומה נמחקה בהצלחה')
      router.refresh()
    } catch (err: any) {
      toast.error('שגיאה במחיקה: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100">
          <MoreHorizontal className="h-4 w-4 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem className="gap-2 text-slate-600">
          <Edit3 className="w-4 h-4" />
          ערוך רשומה
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={handleDelete} 
          disabled={loading}
          className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          מחק רשומה
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
