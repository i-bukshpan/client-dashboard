import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20 text-right" dir="rtl">
      <Link href="/" className="flex items-center gap-2 text-blue-600 font-bold mb-8">
        <ArrowRight className="w-4 h-4" />
        חזרה לדף הבית
      </Link>
      <h1 className="text-4xl font-black mb-8">מדיניות פרטיות</h1>
      <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-bold mb-4">1. איסוף מידע</h2>
          <p>אנחנו אוספים מידע הכרחי לתפעול המערכת בלבד, כולל שמות לקוחות, פרטי קשר ומידע פיננסי שהוזן על ידי המשתמש. המערכת משתמשת ב-Google Drive API כדי לנהל קבצים בתיקיות הלקוח שלך.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold mb-4">2. שימוש במידע</h2>
          <p>המידע משמש אך ורק לניהול הפעילות העסקית של נחמיה דרוק וצוותו. אין העברת מידע לצדדים שלישיים ללא הסכמה מפורשת.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold mb-4">3. אבטחת מידע</h2>
          <p>המערכת מבוססת על Supabase ומיישמת מדיניות אבטחה קפדנית ברמת השורה (RLS) כדי להבטיח שכל משתמש יוכל לגשת רק למידע המורשה עבורו.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold mb-4">4. שירותי Google</h2>
          <p>השימוש ב-Google Drive API נעשה בהתאם למדיניות הפרטיות של Google. המערכת ניגשת אך ורק לתיקיות המוגדרות כתיקיות לקוח במערכת.</p>
        </section>
      </div>
    </div>
  )
}

