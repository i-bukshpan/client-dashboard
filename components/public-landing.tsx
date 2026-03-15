'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowRight, Bot, ShieldCheck, Users, BarChart3, LayoutDashboard, Lock } from 'lucide-react'
import Link from 'next/link'

export function PublicLanding() {
  return (
    <div className="min-h-screen bg-slate-50 overflow-hidden" dir="rtl">
      {/* Hero Section */}
      <section className="relative pt-20 pb-24 md:pt-32 md:pb-32 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-bold text-sm mb-8 animate-fade-in">
            <Bot className="h-4 w-4" />
            מערכת CRM חכמה מבוססת AI לקשר אישי עם לקוחות
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-navy tracking-tight leading-tight mb-8 animate-fade-in-up">
            נהל את העסק שלך <br />
            <span className="text-primary underline decoration-indigo-200">בצורה חכמה יותר</span>
          </h1>
          <p className="max-w-2xl mx-auto text-xl text-grey font-medium leading-relaxed mb-12 animate-fade-in-up delay-100">
            Linknet-Dashboard היא מערכת ניהול לקוחות מתקדמת המשלבת בינה מלאכותית, חיבור ל-Google Drive, ותובנות פיננסיות כדי לעזור לך לצמוח.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-200">
            <Button asChild size="lg" className="rounded-2xl h-14 px-8 text-lg font-black gap-2 shadow-xl shadow-primary/20">
              <Link href="/login">
                כניסה למערכת
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="rounded-2xl h-14 px-8 text-lg font-bold text-navy hover:bg-white/50">
              <Link href="/privacy">מדיניות פרטיות</Link>
            </Button>
          </div>
        </div>

        {/* Floating Decor */}
        <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-navy mb-4">למה לבחור ב-Linknet?</h2>
            <div className="w-20 h-1.5 bg-primary mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Bot className="h-8 w-8 text-primary" />}
              title="סוכן AI צמוד"
              description="עוזר אישי המבוסס על Gemini 1.5 Pro שמכיר את נתוני הלקוחות שלך ועוזר לך לקבל החלטות."
            />
            <FeatureCard 
              icon={<LayoutDashboard className="h-8 w-8 text-indigo-500" />}
              title="דשבורד בוקר חכם"
              description="תקציר יומי שמראה לך את המשימות הדחופות, הפגישות והתובנות הכספיות החשובות ביותר."
            />
            <FeatureCard 
              icon={<ShieldCheck className="h-8 w-8 text-emerald-500" />}
              title="אבטחת מידע"
              description="הנתונים שלך ושל הלקוחות שלך מוגנים בסטנדרטים הגבוהים ביותר עם אימותSupabase."
            />
            <FeatureCard 
              icon={<Users className="h-8 w-8 text-blue-500" />}
              title="ניהול תיק לקוח מאוחד"
              description="כל ההיסטוריה, המשימות והקבצים במקום אחד נקי ומסודר - Unified Timeline."
            />
            <FeatureCard 
              icon={<BarChart3 className="h-8 w-8 text-amber-500" />}
              title="אנליטיקה ותובנות"
              description="דוחות AI תקופתיים וחיזוי תזרים מזומנים המבוססים על נתוני אמת."
            />
            <FeatureCard 
              icon={<Lock className="h-8 w-8 text-slate-500" />}
              title="כספת סיסמאות"
              description="אחסון מאובטח של פרטי גישה וקישורים עבור כל לקוח בנפרד."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-100 bg-slate-50/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-right">
          <div>
            <h3 className="text-lg font-black text-navy mb-2">Linknet-Dashboard</h3>
            <p className="text-sm text-grey font-medium">המערכת המקצועית לניהול לקוחות יועצים פיננסיים.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            <Link href="/privacy" className="text-sm font-bold text-grey hover:text-primary transition-colors">מדיניות פרטיות</Link>
            <Link href="/help" className="text-sm font-bold text-grey hover:text-primary transition-colors">מרכז עזרה</Link>
          </div>
          <div className="text-[11px] font-medium text-grey/60 uppercase tracking-widest">
            © {new Date().getFullYear()} Linknet. כל הזכויות שמורות.
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="p-8 border-transparent hover:border-slate-100 hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-300 rounded-[2.5rem] bg-slate-50/50 group">
      <div className="mb-6 group-hover:scale-110 transition-transform duration-300">{icon}</div>
      <h3 className="text-xl font-black text-navy mb-4 tracking-tight">{title}</h3>
      <p className="text-grey font-medium leading-relaxed">{description}</p>
    </Card>
  )
}
