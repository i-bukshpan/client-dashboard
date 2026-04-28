'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle2, Loader2, Link2Off, Globe } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { syncCalendar } from '@/app/admin/calendar/actions'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'

export function GoogleSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState<boolean | null>(null) // null = loading
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  // Check connection status
  const checkConnection = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return setIsConnected(false)
    const { data } = await supabase.from('google_tokens').select('user_id').eq('user_id', user.id).maybeSingle()
    setIsConnected(!!data)
  }

  useEffect(() => {
    checkConnection()
  }, [])

  // Handle redirects back from Google OAuth
  useEffect(() => {
    const connected = searchParams.get('google_connected')
    const error = searchParams.get('google_error')
    if (connected === 'true') {
      toast({ title: '✅ גוגל קאלנדר חובר בהצלחה!', description: 'כעת תוכל לסנכרן פגישות מהיומן שלך.' })
      setIsConnected(true)
      router.replace('/admin/calendar')
    }
    if (error) {
      const msgs: Record<string, string> = {
        access_denied: 'אישור הגישה נדחה',
        save_failed: 'שגיאה בשמירת הטוקן',
        token_exchange_failed: 'שגיאה בתהליך ההתחברות',
      }
      toast({ title: 'שגיאת התחברות לגוגל', description: msgs[error] || error, variant: 'destructive' })
      router.replace('/admin/calendar')
    }
  }, [searchParams])

  const handleConnect = () => {
    window.location.href = '/api/google/auth'
  }

  const handleDisconnect = async () => {
    if (!confirm('האם אתה בטוח שברצונך לנתק את חשבון גוגל?')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('google_tokens').delete().eq('user_id', user.id)
    setIsConnected(false)
    toast({ title: 'הנתקת את גוגל קאלנדר', description: 'תוכל לחבר מחדש בכל עת.' })
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const res = await syncCalendar()
      if (res.error) throw new Error(res.error)
      const synced = 'syncedCount' in res ? res.syncedCount : 0
      setLastSync(new Date().toLocaleTimeString('he-IL'))
      toast({ title: 'סנכרון הושלם', description: `סונכרנו ${synced} פגישות מיומן גוגל.` })
    } catch (error: any) {
      toast({ title: 'שגיאה בסנכרון', description: error.message || 'לא ניתן היה לסנכרן עם גוגל.', variant: 'destructive' })
    } finally {
      setIsSyncing(false)
    }
  }

  if (isConnected === null) {
    return <Button variant="outline" size="sm" disabled className="gap-2"><Loader2 className="w-4 h-4 animate-spin" />טוען...</Button>
  }

  if (!isConnected) {
    return (
      <Button
        onClick={handleConnect}
        variant="outline"
        size="sm"
        className="gap-2 border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 font-medium"
      >
        <Globe className="w-4 h-4" />
        חבר Google Calendar
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {lastSync && (
        <span className="text-[10px] text-muted-foreground italic flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          סונכרן ב-{lastSync}
        </span>
      )}
      <Button
        onClick={handleSync}
        disabled={isSyncing}
        variant="outline"
        size="sm"
        className="gap-2 border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-700"
      >
        {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        סנכרן
      </Button>
      <Button
        onClick={handleDisconnect}
        variant="ghost"
        size="sm"
        title="נתק חשבון גוגל"
        className="gap-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50"
      >
        <Link2Off className="w-3.5 h-3.5" />
        <span className="text-xs">נתק</span>
      </Button>
    </div>
  )
}
