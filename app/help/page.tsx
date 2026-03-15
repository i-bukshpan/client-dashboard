'use client'

import { Card } from '@/components/ui/card'
import { HelpCircle, BookOpen, MessageCircle, Shield, ArrowLeft, Search, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function HelpPage() {
  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-12 bg-background min-h-screen" dir="rtl">
      <div className="text-center space-y-4 py-10">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner mb-2">
          <HelpCircle className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-black text-navy tracking-tight">איך נוכל לעזור היום?</h1>
        <p className="text-grey font-medium max-w-xl mx-auto italic">
          מרכז העזרה והתמיכה של מערכת Linkנט לניהול לקוחות פיננסיים.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <HelpCard 
          icon={Sparkles} 
          title="שימוש בסוכן ה-AI"
          content="הסוכן האישי שלך זמין בכל כרטיס לקוח. לחץ על כפתור הניצוץ (Sparkles) כדי להתחיל לשאול שאלות על תיק הלקוח או לסכם פגישות."
        />
        <HelpCard 
          icon={Search} 
          title="חיפוש מהיר (Cmd+K)"
          content="חפש לקוחות, משימות או פגישות מכל מקום במערכת באמצעות קיצור הדרך Ctrl+K (או Cmd+K במאק)."
        />
        <HelpCard 
          icon={BookOpen} 
          title="חיבור Google Drive"
          content="קשר תיקיות Drive ללקוחות תחת הטאב 'ניהול פנימי'. הסוכן יוכל לקרוא את המסמכים ולעזור לך לנתח אותם."
        />
        <HelpCard 
          icon={Shield} 
          title="מדיניות ופרטיות"
          content="אנחנו דואגים למידע שלך. קרא את מדיניות הפרטיות המלאה שלנו כדי להבין איך אנחנו מגנים על הנתונים."
          link="/privacy"
          linkText="למדיניות הפרטיות"
        />
      </div>

      <Card className="p-8 rounded-3xl border-none bg-gradient-to-br from-navy to-slate-800 text-white shadow-2xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
          <MessageCircle className="h-32 w-32" />
        </div>
        <div className="relative z-10 space-y-6">
          <h2 className="text-2xl font-black tracking-tight">צריך תמיכה אישית?</h2>
          <p className="text-slate-300 max-w-lg">
            אם נתקלת בבעיה טכנית או שיש לך שאלה לגבי השימוש במערכת, הצוות שלנו זמין עבורך.
          </p>
          <button className="bg-white text-navy px-6 py-3 rounded-xl font-bold hover:bg-white/90 transition-all active:scale-95 shadow-lg">
            שלח הודעה לתמיכה
          </button>
        </div>
      </Card>
    </div>
  )
}

function HelpCard({ icon: Icon, title, content, link, linkText }: any) {
  return (
    <Card className="p-8 rounded-3xl border-border/40 bg-card hover:shadow-xl transition-all group flex flex-col h-full">
      <div className="p-3 rounded-2xl bg-secondary w-fit text-primary mb-6 group-hover:scale-110 transition-transform">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-bold text-navy mb-3">{title}</h3>
      <p className="text-grey text-sm leading-relaxed flex-1">{content}</p>
      {link && (
        <Link href={link} className="mt-6 flex items-center gap-2 text-primary text-sm font-black hover:underline group/link">
          {linkText} <ArrowLeft className="h-4 w-4 transition-transform group-hover/link:-translate-x-1" />
        </Link>
      )}
    </Card>
  )
}
