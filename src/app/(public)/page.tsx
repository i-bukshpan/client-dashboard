import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TrendingUp, Zap, Users, ChevronLeft, BarChart3, Globe, Shield, ArrowRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-sm">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">
              Nehemiah OS
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">יכולות</a>
            <a href="#security" className="hover:text-slate-900 transition-colors">אבטחה</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">אודות</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">כניסה</Link>
            <Button asChild className="rounded-lg px-6 bg-slate-900 hover:bg-slate-800 text-white border-none shadow-sm font-medium h-9">
              <Link href="/login">התחברות</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden z-10">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <Zap className="w-3.5 h-3.5 fill-current" />
            מערכת הניהול החדשה זמינה כעת
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-slate-900">
            ניהול פיננסי,<br className="hidden md:block" />
            <span className="text-slate-500">ברמה של חברת הייטק.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl mx-auto font-medium">
            מערכת ניהול חכמה, נקייה ומהירה המשלבת CRM מתקדם ותזרים מזומנים. הכל מרוכז במקום אחד, מעוצב בקפידה ומיועד ליועצים פיננסיים שרוצים יותר.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="rounded-xl px-8 h-12 text-base font-semibold bg-slate-900 text-white hover:bg-slate-800 shadow-md gap-2 group transition-all">
              <Link href="/login">
                כניסה למערכת
                <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-xl px-8 h-12 text-base font-semibold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all">
              מידע נוסף
            </Button>
          </div>

          {/* Abstract Image Placeholder/Icon Cloud */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 text-slate-400">
            <div className="flex flex-col items-center justify-center gap-3"><Globe className="w-6 h-6 stroke-[1.5]"/><span className="text-xs font-semibold uppercase tracking-wider">ענן מלא</span></div>
            <div className="flex flex-col items-center justify-center gap-3"><Shield className="w-6 h-6 stroke-[1.5]"/><span className="text-xs font-semibold uppercase tracking-wider">אבטחה מחמירה</span></div>
            <div className="flex flex-col items-center justify-center gap-3"><BarChart3 className="w-6 h-6 stroke-[1.5]"/><span className="text-xs font-semibold uppercase tracking-wider">דוחות בזמן אמת</span></div>
            <div className="flex flex-col items-center justify-center gap-3"><Users className="w-6 h-6 stroke-[1.5]"/><span className="text-xs font-semibold uppercase tracking-wider">ניהול לקוחות</span></div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 relative z-10 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">יכולות המערכת</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg">כל מה שאתה צריך כדי לנהל את העסק שלך בצורה מושלמת.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                title: 'ניהול לקוחות (CRM)', 
                icon: Users, 
                desc: 'כרטיס לקוח 360°, תיקיות מסמכים אוטומטיות ב-Google Drive, ותיעוד היסטוריה מלא בקליק.',
              },
              { 
                title: 'בקרה פיננסית', 
                icon: BarChart3, 
                desc: 'מעקב הכנסות והוצאות, דוחות רווח והפסד בזמן אמת, וגרפים אינטראקטיביים לניתוח ביצועים מדוייק.',
              },
              { 
                title: 'ניהול משימות וצוות', 
                icon: Zap, 
                desc: 'לוח משימות (Kanban), חישובי שכר אוטומטיים לעובדים, ומעקב ביצועים קבוצתי שקוף ויעיל.',
              },
            ].map((f, i) => (
              <div key={i} className="group p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-300 hover:shadow-sm transition-all duration-300 relative overflow-hidden">
                <div className={`w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-6 shadow-sm`}>
                  <f.icon className="w-6 h-6 text-slate-700 stroke-[1.5]" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900">{f.title}</h3>
                <p className="text-slate-600 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-50 z-10 relative">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-sm text-slate-900">Nehemiah OS</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500 font-medium">
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">פרטיות</Link>
            <Link href="/terms" className="hover:text-slate-900 transition-colors">תנאים</Link>
          </div>
          <p className="text-xs text-slate-400 mt-4 md:mt-0">
            © {new Date().getFullYear()} Nehemiah Druck. כל הזכויות שמורות.
          </p>
        </div>
      </footer>
    </div>
  )
}

