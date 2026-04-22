import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TrendingUp, ShieldCheck, Zap, Users, CheckCircle2, ChevronLeft } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/40 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-xl tracking-tight">Nehemiah OS</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-blue-600 transition-colors">כניסה למערכת</Link>
            <Button size="sm" asChild className="rounded-full px-6 bg-blue-600 hover:bg-blue-500">
              <Link href="/login">התחל עכשיו</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] opacity-20 pointer-events-none">
          <div className="absolute top-20 right-0 w-96 h-96 bg-blue-500 rounded-full blur-[120px]" />
          <div className="absolute top-40 left-0 w-96 h-96 bg-purple-500 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold mb-6 animate-fade-in">
            <Zap className="w-3 h-3 fill-current" />
            מערכת ניהול פיננסית מתקדמת V2.0
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-8 bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
            לנהל את העסק הפיננסי <br className="hidden md:block" />
            <span className="gradient-text">בדיוק ובביטחון מקסימלי</span>
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto">
            מערכת ה-OS של נחמיה דרוק מעניקה שליטה מלאה על לקוחות, משימות, צוות ותזרים מזומנים – הכל במקום אחד, מאובטח ומסונכרן בזמן אמת.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="rounded-full px-10 h-14 text-lg font-bold bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-600/30 gap-2">
              לכניסה למערכת
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-10 h-14 text-lg font-bold border-slate-200">
              איך זה עובד?
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'ניהול CRM חכם', icon: Users, desc: 'מעקב מלא אחר לקוחות, היסטוריה פיננסית וסנכרון קבצי Google Drive.' },
              { title: 'תזרים מזומנים', icon: TrendingUp, desc: 'דוחות גרפיים מתקדמים, ניהול הכנסות והוצאות בלחיצת כפתור.' },
              { title: 'אבטחת מידע', icon: ShieldCheck, desc: 'מערכת הרשאות קפדנית (RLS) המפרידה בין המנהל לעובדים.' },
            ].map((f, i) => (
              <div key={i} className="p-8 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mb-6">
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-right">
              <div className="flex items-center gap-2 mb-4 justify-center md:justify-start">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <span className="font-black text-xl">Nehemiah OS</span>
              </div>
              <p className="text-sm text-slate-500">ניהול עסק פיננסי מקצה לקצה.</p>
            </div>
            <div className="flex gap-8 text-sm font-medium text-slate-500">
              <Link href="/privacy" className="hover:text-blue-600 transition-colors">מדיניות פרטיות</Link>
              <Link href="/terms" className="hover:text-blue-600 transition-colors">תנאי שימוש</Link>
              <Link href="/support" className="hover:text-blue-600 transition-colors">תמיכה</Link>
            </div>
          </div>
          <div className="mt-12 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Nehemiah Druck. כל הזכויות שמורות.
          </div>
        </div>
      </footer>
    </div>
  )
}
