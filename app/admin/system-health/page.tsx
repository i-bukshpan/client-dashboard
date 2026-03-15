'use client'

import { useState, useEffect } from 'react'
import { Shield, CheckCircle2, AlertCircle, Database, Sparkles, HardDrive, RefreshCw, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function SystemHealthPage() {
    const [status, setStatus] = useState({
        supabase: 'checking',
        gemini: 'checking',
        storage: 'checking'
    })
    const [errors, setErrors] = useState<Record<string, string>>({})

    const checkHealth = async () => {
        setStatus({ supabase: 'checking', gemini: 'checking', storage: 'checking' })
        setErrors({})

        // 1. Check Supabase
        try {
            const { error } = await supabase.from('clients').select('id', { head: true, count: 'exact' })
            if (error) throw error
            setStatus(prev => ({ ...prev, supabase: 'ok' }))
        } catch (err: any) { 
            setStatus(prev => ({ ...prev, supabase: 'error' }))
            setErrors(prev => ({ ...prev, supabase: err.message || 'שגיאת חיבור לבסיס הנתונים' }))
        }

        // 2. Check Gemini
        try {
            const res = await fetch('/api/health/ai')
            if (!res.ok) {
                const msg = await res.text()
                throw new Error(msg || 'שגיאה בחיבור ל-AI')
            }
            setStatus(prev => ({ ...prev, gemini: 'ok' }))
        } catch (err: any) { 
            setStatus(prev => ({ ...prev, gemini: 'error' }))
            setErrors(prev => ({ ...prev, gemini: err.message }))
        }

        // 3. Check Storage
        try {
            const { error } = await supabase.storage.listBuckets()
            if (error) throw error
            setStatus(prev => ({ ...prev, storage: 'ok' }))
        } catch (err: any) { 
            setStatus(prev => ({ ...prev, storage: 'error' }))
            setErrors(prev => ({ ...prev, storage: err.message || 'שגיאה בחיבור לאחסון' }))
        }
    }

    useEffect(() => { checkHealth() }, [])

    return (
        <div className="p-10 max-w-4xl mx-auto space-y-8" dir="rtl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black text-navy tracking-tight">הגדרות ותקינות מערכת</h1>
                    <p className="text-grey font-bold">ניטור חיבורי AI, בסיס נתונים ואחסון קבצים</p>
                </div>
                <Button onClick={checkHealth} variant="outline" className="rounded-xl gap-2 font-bold">
                    <RefreshCw className="h-4 w-4" />
                    בדיקה מחודשת
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <HealthCard 
                    title="Gemini AI" 
                    icon={Sparkles} 
                    status={status.gemini} 
                    error={errors.gemini}
                    description="מנוע הבינה המלאכותית לניתוח שוק ותובנות"
                />
                <HealthCard 
                    title="Supabase DB" 
                    icon={Database} 
                    status={status.supabase} 
                    error={errors.supabase}
                    description="בסיס הנתונים המרכזי של הלקוחות והמערכת"
                />
                <HealthCard 
                    title="Storage" 
                    icon={HardDrive} 
                    status={status.storage} 
                    error={errors.storage}
                    description="אחסון מסמכים, צילומים וקיבצי דאטה"
                />
            </div>

            <Card className="rounded-[2.5rem] p-8 space-y-6 border-border/50 bg-white/60">
                <h2 className="text-xl font-black text-navy">קישוריות צד שלישי</h2>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-border/40">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-green-500/10 rounded-xl text-green-600">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-bold text-navy">Google Site Verification</p>
                                <p className="text-xs text-grey">האתר מאומת ב-Google Search Console</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-border/40">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600">
                                <Database className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-bold text-navy">Interactive Agent Tools</p>
                                <p className="text-xs text-grey">כלי ניהול פגישות, משימות וניתוח Sheets פעילים</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                             <span className="text-[10px] font-black text-emerald-600">פעיל</span>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    )
}

function HealthCard({ title, icon: Icon, status, description, error }: any) {
    const isOk = status === 'ok'
    const isChecking = status === 'checking'

    return (
        <Card className="rounded-[2rem] p-6 space-y-4 border-border/50 bg-white relative overflow-hidden group min-h-[180px]">
            <div className={`absolute top-0 right-0 w-2 h-full ${isOk ? 'bg-emerald-500' : isChecking ? 'bg-amber-400' : 'bg-rose-500'}`} />
            
            <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${isOk ? 'bg-emerald-50 text-emerald-500' : isChecking ? 'bg-amber-50 text-amber-500' : 'bg-rose-50 text-rose-500'}`}>
                    <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-black text-navy">{title}</h3>
            </div>
            
            <div>
                <p className="text-xs text-grey font-medium leading-relaxed">
                    {description}
                </p>
                {!isOk && !isChecking && error && (
                    <p className="text-[10px] text-rose-500 mt-2 font-mono bg-rose-50 p-2 rounded-lg break-all">
                        {error}
                    </p>
                )}
            </div>

            <div className="flex items-center gap-2 pt-2">
                {isOk ? (
                    <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-black text-emerald-600">מחובר ותקין</span>
                    </>
                ) : isChecking ? (
                    <>
                        <div className="h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-black text-amber-600">בודק...</span>
                    </>
                ) : (
                    <>
                        <AlertCircle className="h-4 w-4 text-rose-500" />
                        <span className="text-xs font-black text-rose-600">שגיאת חיבור</span>
                    </>
                )}
            </div>
        </Card>
    )
}
