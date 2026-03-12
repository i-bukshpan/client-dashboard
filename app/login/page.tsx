'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Shield, Lock, Mail, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast.error('שגיאה בהתחברות', {
          description: error.message === 'Invalid login credentials' 
            ? 'אימייל או סיסמה שגויים' 
            : error.message
        })
      } else {
        toast.success('ברוך הבא!', {
          description: 'מתחבר למערכת...'
        })
        router.push('/')
        router.refresh()
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error('שגיאה לא צפויה', {
        description: 'אנא נסה שוב מאוחר יותר'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden" dir="rtl">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        {/* Logo/Brand */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-6 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
            <Shield className="h-9 w-9" />
          </div>
          <h1 className="text-3xl font-black text-navy dark:text-white tracking-tight mb-2">ניהול לקוחות - דרוק</h1>
          <p className="text-grey dark:text-slate-400 font-medium">כניסת יועץ למערכת הניהול</p>
        </div>

        <Card className="p-8 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl border-border/50 shadow-2xl rounded-[2rem]">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-navy dark:text-slate-200 block px-1">אימייל</label>
              <div className="relative group">
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-grey group-focus-within:text-primary transition-colors">
                  <Mail className="h-4 w-4" />
                </div>
                <Input
                  type="email"
                  placeholder="name@advisor.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pr-11 h-12 bg-white/50 dark:bg-slate-800/50 rounded-xl border-slate-200/50 dark:border-slate-700/50 focus:ring-primary/20 transition-all font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-sm font-bold text-navy dark:text-slate-200 block">סיסמה</label>
                <button type="button" className="text-xs font-bold text-primary hover:underline">שכחתי סיסמה?</button>
              </div>
              <div className="relative group">
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-grey group-focus-within:text-primary transition-colors">
                  <Lock className="h-4 w-4" />
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-11 h-12 bg-white/50 dark:bg-slate-800/50 rounded-xl border-slate-200/50 dark:border-slate-700/50 focus:ring-primary/20 transition-all font-medium"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-70"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>מתחבר...</span>
                </div>
              ) : 'התחבר למערכת'}
            </Button>
          </form>

        </Card>

        <p className="mt-10 text-center text-xs font-bold text-grey/60 uppercase tracking-widest">
          Secured By Supabase Auth & Linked Dashboard
        </p>
      </div>
    </div>
  )
}
