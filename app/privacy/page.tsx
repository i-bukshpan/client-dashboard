'use client'

import { Card } from '@/components/ui/card'
import { ShieldCheck, Lock, Eye, FileText, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-10 bg-background min-h-screen" dir="rtl">
      <div className="space-y-4">
        <Link href="/help" className="flex items-center gap-2 text-primary hover:underline text-sm font-bold w-fit">
          <ArrowRight className="h-4 w-4" /> חזרה למרכז העזרה
        </Link>
        <h1 className="text-4xl font-black text-navy tracking-tight flex items-center gap-4">
          <ShieldCheck className="h-10 w-10 text-primary" />
          מדיניות פרטיות - Linkנט
        </h1>
        <p className="text-grey font-medium text-lg">
          פרטיותך ופרטיות לקוחותיך נמצאות בראש סדר העדיפויות שלנו. להלן פירוט אופן הטיפול במידע במערכת.
        </p>
      </div>

      <div className="grid gap-6">
        <PrivacySection 
          icon={Lock} 
          title="אבטחת מידע"
          content="המערכת משתמשת בתשתית Supabase מאובטחת, הכוללת הצפנה של נתונים במעבר ובמנוחה. הגישה למערכת מוגנת באמצעות אימות דו-שלבי וניהול הרשאות קפדני."
        />
        <PrivacySection 
          icon={Eye} 
          title="איסוף ושימוש במידע"
          content="המערכת אוספת נתונים שהוזנו על ידי המשתמש (פרטי לקוחות, תשלומים, משימות) ונתונים מתוך קבצי Google Drive המקושרים. המידע משמש אך ורק לניהול השוטף של תיקי הלקוחות ולתפעול תכונות המערכת."
        />
        <PrivacySection 
          icon={FileText} 
          title="בינה מלאכותית (AI)"
          content="השימוש בסוכן ה-AI מבוסס על מנוע Google Gemini. חלקי מידע רלוונטיים נשלחים לעיבוד על מנת להפיק תובנות, סיכומי פגישות ומענה לשאלות. גוגל אינה משתמשת במידע זה לאימון מודלים ציבוריים ללא הסכמה מפורשת."
        />
      </div>

      <Card className="p-8 rounded-3xl border-border/40 bg-white/50 backdrop-blur-md shadow-sm space-y-4">
        <h3 className="text-xl font-bold text-navy">צור קשר בנושאי פרטיות</h3>
        <p className="text-grey text-sm">
          אם יש לך שאלות לגבי אופן הניהול של המידע במערכת, ניתן לפנות למנהל המערכת:  
          <br />
          <strong>נחמיה דרוק - פתרונות פיננסיים</strong>
        </p>
      </Card>

      <footer className="text-center py-10 text-grey/40 text-[11px] font-bold uppercase tracking-widest">
        עודכן לאחרונה: מרץ 2026
      </footer>
    </div>
  )
}

function PrivacySection({ icon: Icon, title, content }: { icon: any, title: string, content: string }) {
  return (
    <Card className="p-6 rounded-3xl border-border/40 bg-card hover:shadow-md transition-all group">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
          <Icon className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-navy">{title}</h2>
          <p className="text-grey leading-relaxed">{content}</p>
        </div>
      </div>
    </Card>
  )
}
