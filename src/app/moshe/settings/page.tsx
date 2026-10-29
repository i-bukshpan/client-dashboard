'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, Save, User, Mail, Lock, LogOut, CheckCircle2, Download, HardDrive, Bot, FileText, FileSpreadsheet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { MosheMCPModal } from '@/components/moshe/MosheMCPModal'
import { MosheBackupModal } from '@/components/moshe/MosheBackupModal'

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
  const [backupLoading, setBackupLoading] = useState(false)
  const [driveBackupLoading, setDriveBackupLoading] = useState(false)

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

  async function handleBackup(format: 'html' | 'csv' | 'json', uploadToDrive: boolean) {
    const set = uploadToDrive ? setDriveBackupLoading : setBackupLoading
    set(true)
    try {
      const params = new URLSearchParams({ format })
      if (uploadToDrive) params.set('drive', '1')
      const url = `/api/moshe/backup?${params.toString()}`
      const res = await fetch(url)
      if (!res.ok) { const d = await res.json(); alert(d.error ?? 'שגיאה'); return }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const date = new Date().toISOString().slice(0, 10)
      const ext = format === 'html' ? 'html' : format === 'csv' ? 'csv' : 'json'
      a.download = `moshe-portal-backup-${date}.${ext}`
      a.click()
      URL.revokeObjectURL(a.href)
      if (uploadToDrive) alert('גיבוי הועלה לתיקיית "גיבויים" בדרייב והורד למכשירך')
    } finally {
      set(false)
    }
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

      {/* MCP Bot Integrations */}
      <div className="bg-white rounded-2xl border border-amber-200/80 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-amber-600" />
              חיבור בוטים ו-MCP
            </p>
            <p className="text-xs text-slate-500 mt-1">חיבור בוט וואטסאפ (WhatsApp Bot), n8n, Claude Desktop ו-Cursor למידע של פורטל משה</p>
          </div>
          <MosheMCPModal />
        </div>
        <p className="text-[11px] text-slate-400">
          השרת מוגן באמצעות טוקן ומאפשר לבוטים חיצוניים לתשאל פרויקטים, לוחות תשלומים, קונים, הלוואות ועובדים ללא חשיפת שאר המערכת.
        </p>
      </div>

      {/* Backup */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">גיבוי נתונים</p>
            <p className="text-xs text-slate-400 mt-1">ייצוא כל המידע של הפורטל (פרויקטים, קונים, תשלומים, הלוואות ושותפים) לקובץ אחד מסודר</p>
          </div>
          <MosheBackupModal />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            type="button"
            onClick={() => handleBackup('html', false)}
            disabled={backupLoading}
            className="font-bold gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {backupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            דוח גיבוי מסודר לקריאה/הדפסה
          </Button>
          <Button
            type="button"
            onClick={() => handleBackup('csv', false)}
            disabled={backupLoading}
            variant="outline"
            className="font-bold gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            {backupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            הורד קובץ גיבוי לאקסל (CSV)
          </Button>
          <Button
            type="button"
            onClick={() => handleBackup('json', false)}
            disabled={backupLoading}
            variant="outline"
            className="font-bold gap-2 border-slate-200"
          >
            {backupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            הורד גיבוי מערכת (JSON)
          </Button>
          <Button
            type="button"
            onClick={() => handleBackup('json', true)}
            disabled={driveBackupLoading}
            variant="outline"
            className="font-bold gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            {driveBackupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            {driveBackupLoading ? 'מעלה לדרייב...' : 'גיבוי מלא + העלה לדרייב'}
          </Button>
        </div>
        <p className="text-[11px] text-slate-400">הגיבוי מכיל את כל הפרויקטים, הקונים, לוחות התשלומים, התנועות בפועל, העסקאות, ההלוואות, השותפים, השכנים, העובדים והמסמכים.</p>
      </div>

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
