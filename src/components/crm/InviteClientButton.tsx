'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mail, Loader2, Check } from 'lucide-react'
import { inviteClientToPortal } from '@/app/admin/crm/actions'
import { toast } from 'sonner'

interface Props {
  clientId: string
  email: string
  name: string
  isInvited: boolean
}

export function InviteClientButton({ clientId, email, name, isInvited }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(isInvited)

  async function handleInvite(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    
    if (done) return

    setLoading(true)
    try {
      const res = await inviteClientToPortal(clientId, email, name)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('הזמנה נשלחה בהצלחה ללקוח')
        setDone(true)
      }
    } catch (err) {
      toast.error('אירעה שגיאה בשליחת ההזמנה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button 
      variant={done ? "ghost" : "outline"}
      size="sm"
      className={done ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 h-8" : "h-8 gap-2 border-primary/20 text-primary hover:bg-primary/5"}
      disabled={loading || done}
      onClick={handleInvite}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : done ? <Check className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
      {done ? 'הוזמן לפורטל' : 'הזמן לפורטל'}
    </Button>
  )
}
