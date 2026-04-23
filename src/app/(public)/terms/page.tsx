import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20 text-right" dir="rtl">
      <Link href="/" className="flex items-center gap-2 text-blue-600 font-bold mb-8">
        <ArrowRight className="w-4 h-4" />
        חזרה לדף הבית
      </Link>
      <h1 className="text-4xl font-black mb-8">תנאי שימוש</h1>
      <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
        <p className="text-lg text-muted-foreground">ברוכים הבאים ל-Nehemiah OS. השימוש במערכת כפוף לתנאים הבאים:</p>
        
        <section>
          <h2 className="text-xl font-bold mb-4">1. הרשאת שימוש</h2>
          <p>המערכת מיועדת לשימוש פנימי בלבד של נחמיה דרוק וצוות המשרד. חל איסור מוחלט להעביר פרטי גישה לצדדים שלישיים.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">2. אחריות על נתונים</h2>
          <p>המשתמש אחראי על דיוק הנתונים המוזנים למערכת. נחמיה דרוק אינו אחראי לתוצאות פיננסיות הנובעות מהזנת נתונים שגויה.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">3. קניין רוחני</h2>
          <p>כל הזכויות במערכת, בקוד המקור ובממשק המשתמש שייכות לנחמיה דרוק.</p>
        </section>
      </div>
    </div>
  )
}

