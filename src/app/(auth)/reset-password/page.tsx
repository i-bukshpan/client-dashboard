'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, TrendingUp, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function checkAuth() {
      try {
        // 1. Check if code parameter is present in URL search params (PKCE fallback)
        if (typeof window !== 'undefined') {
          const searchParams = new URLSearchParams(window.location.search)
          const code = searchParams.get('code')
          if (code) {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
            if (!exchangeError && data?.session) {
              setHasSession(true)
              setIsCheckingSession(false)
              return
            }
          }
        }

        // 2. Check existing session
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setHasSession(true)
        }
      } catch (err: any) {
        console.error('Auth verification error:', err)
      } finally {
        setIsCheckingSession(false)
      }
    }

    checkAuth()

    // 3. Listen to auth state changes (e.g. PASSWORD_RECOVERY event from Supabase client)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && (event === 'SIGNED_IN' || event === 'USER_UPDATED'))) {
        setHasSession(true)
        setIsCheckingSession(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים')
      return
    }
    if (password !== confirm) {
      setError('הסיסמאות אינן תואמות')
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (updateError) {
      setError(updateError.message || 'שגיאה בעדכון הסיסמה, אנא נסה שוב')
      return
    }

    setDone(true)
    setTimeout(() => {
      router.push('/login')
    }, 2500)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] p-6">
      <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center shadow-md mb-4">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Nehemiah OS</h1>
          <p className="text-slate-500 text-sm mt-1">מערכת הניהול הפיננסי שלך</p>
        </div>

        <Card className="border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/80 backdrop-blur-xl rounded-2xl">
          <CardHeader className="pb-6 pt-8 px-8 text-center">
            <CardTitle className="text-xl font-bold text-slate-900">קביעת סיסמה חדשה</CardTitle>
            <CardDescription className="text-slate-500">בחר סיסמה חזקה לחשבון שלך</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            {done ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-slate-800 font-semibold">הסיסמה עודכנה בהצלחה!</p>
                <p className="text-slate-500 text-sm">מעביר אותך לדף הכניסה...</p>
              </div>
            ) : isCheckingSession ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                <p className="text-xs text-slate-500 font-medium">מאמת קישור איפוס...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {!hasSession && (
                  <div className="bg-amber-50 text-amber-800 border border-amber-200/60 rounded-lg p-3 text-xs leading-relaxed flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      שים לב: אם הקישור פג תוקף, תוכל לבקש קישור איפוס חדש ב-
                      <Link href="/forgot-password" className="underline font-semibold ms-1 hover:text-amber-950">
                        שכחת סיסמה
                      </Link>
                      .
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 font-medium text-sm">סיסמה חדשה</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="לפחות 6 תווים"
                      className="h-11 bg-slate-50/50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg ps-10 transition-all"
                      dir="ltr"
                      required
                    />
                    <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm" className="text-slate-700 font-medium text-sm">אימות סיסמה</Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showPass ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="חזור על הסיסמה"
                      className="h-11 bg-slate-50/50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg ps-10 transition-all"
                      dir="ltr"
                      required
                    />
                    <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 border border-red-100 rounded-lg p-3 text-sm font-medium animate-in fade-in">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm font-medium transition-all active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {loading ? 'שומר...' : 'שמור סיסמה'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
