'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, TrendingUp, Mail, ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const origin = typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || 'https://ndfm.ibsites.co.il')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] p-6">
      <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Link href="/login" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 text-sm mb-8 transition-colors group font-medium">
          <ArrowRight className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
          חזרה לכניסה
        </Link>

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center shadow-md mb-4">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Nehemiah OS</h1>
          <p className="text-slate-500 text-sm mt-1">מערכת הניהול הפיננסי שלך</p>
        </div>

        <Card className="border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/80 backdrop-blur-xl rounded-2xl">
          <CardHeader className="pb-6 pt-8 px-8 text-center">
            <CardTitle className="text-xl font-bold text-slate-900">שכחת סיסמה?</CardTitle>
            <CardDescription className="text-slate-500">הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            {sent ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-slate-800 font-semibold">הקישור נשלח!</p>
                <p className="text-slate-500 text-sm leading-relaxed">
                  בדוק את תיבת הדואר שלך ב-<span className="font-medium text-slate-700 dir-ltr">{email}</span> ולחץ על הקישור לאיפוס הסיסמה.
                </p>
                <Link href="/login" className="block text-sm text-slate-500 hover:text-slate-900 transition-colors mt-4 font-medium">
                  חזרה לכניסה
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium text-sm">אימייל</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="h-11 bg-slate-50/50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg ps-10 transition-all"
                      dir="ltr"
                      required
                    />
                    <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 border border-red-100 rounded-lg p-3 text-sm font-medium animate-in fade-in">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm font-medium transition-all active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {loading ? 'שולח...' : 'שלח קישור איפוס'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
