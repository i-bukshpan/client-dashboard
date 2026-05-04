'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, Save, User, Mail, Lock, LogOut, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? '')
        setDisplayName(data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? '')
      }
    })
  }, [])

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: displayName },
      })
      if (error) { setMsg({ type: 'error', text: error.message }); return }
      setMsg({ type: 'success', text: 'הפרטים עודכנו בהצלחה' })
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'הסיסמאות אינן תואמות' })
      return
    }
    if (newPassword.length < 6) {
      setPwMsg({ type: 'error', text: 'הסיסמה חייבת להכיל לפחות 6 תווים' })
      return
    }
    setPwLoading(true)
    setPwMsg(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) { setPwMsg({ type: 'error', text: error.message }); return }
      setPwMsg({ type: 'success', text: 'הסיסמה שונתה בהצלחה' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } finally {
      setPwLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">הגדרות חשבון</h1>
        <p className="text-sm text-slate-500 mt-0.5">ניהול פרטים אישיים וסיסמה</p>
      </div>

      {/* Profile details */}
      <form onSubmit={handleUpdateProfile} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">פרטים אישיים</p>

        <div className="space-y-2">
          <Label className="text-slate-700 font-medium">שם תצוגה</Label>
          <div className="relative">
            <Input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="שם מלא"
              className="h-10 border-slate-200 bg-white pr-10"
            />
            <User className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-700 font-medium">כתובת מייל</Label>
          <div className="relative">
            <Input
              value={email}
              readOnly
              disabled
              className="h-10 border-slate-200 bg-slate-50 text-slate-400 pr-10"
            />
            <Mail className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          </div>
          <p className="text-[11px] text-slate-400">לשינוי כתובת המייל פנה לתמיכה</p>
        </div>

        {msg && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {msg.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {msg.text}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {loading ? 'שומר...' : 'שמור פרטים'}
        </Button>
      </form>

      {/* Change password */}
      <form onSubmit={handleChangePassword} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">שינוי סיסמה</p>

        <div className="space-y-2">
          <Label className="text-slate-700 font-medium">סיסמה חדשה</Label>
          <div className="relative">
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="לפחות 6 תווים"
              className="h-10 border-slate-200 bg-white pr-10"
              minLength={6}
            />
            <Lock className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-700 font-medium">אימות סיסמה חדשה</Label>
          <div className="relative">
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="חזור על הסיסמה"
              className="h-10 border-slate-200 bg-white pr-10"
            />
            <Lock className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          </div>
        </div>

        {pwMsg && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${pwMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {pwMsg.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {pwMsg.text}
          </div>
        )}

        <Button
          type="submit"
          disabled={pwLoading || !newPassword}
          variant="outline"
          className="w-full font-bold gap-2 border-slate-200"
        >
          {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          {pwLoading ? 'מחליף סיסמה...' : 'החלף סיסמה'}
        </Button>
      </form>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl border border-red-100 p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-4">יציאה מהמערכת</p>
        <Button
          type="button"
          onClick={handleLogout}
          variant="outline"
          className="w-full border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 font-bold gap-2"
        >
          <LogOut className="w-4 h-4" />
          התנתק מהמערכת
        </Button>
      </div>
    </div>
  )
}
