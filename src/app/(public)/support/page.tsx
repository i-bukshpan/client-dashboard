'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

export default function SupportPage() {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // Simulate API call
    await new Promise(r => setTimeout(r, 1500))
    toast.success('הודעתך נשלחה בהצלחה! נחזור אליך בהקדם.')
    setLoading(false)
    ;(e.target as HTMLFormElement).reset()
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-right" dir="rtl">
      <Link href="/" className="flex items-center gap-2 text-blue-600 font-bold mb-8">
        <ArrowRight className="w-4 h-4" />
        חזרה לדף הבית
      </Link>
      <h1 className="text-4xl font-black mb-4">תמיכה ושירות</h1>
      <p className="text-muted-foreground mb-8 text-lg">זקוק לעזרה בשימוש במערכת? נשמח לסייע.</p>

      <Card className="border-border/50 shadow-xl">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>שם מלא</Label>
              <Input required placeholder="ישראל ישראלי" />
            </div>
            <div className="space-y-2">
              <Label>כתובת אימייל</Label>
              <Input type="email" required dir="ltr" placeholder="mail@example.com" />
            </div>
            <div className="space-y-2">
              <Label>נושא</Label>
              <Input required placeholder="במה נוכל לעזור?" />
            </div>
            <div className="space-y-2">
              <Label>תוכן ההודעה</Label>
              <Textarea required className="min-h-[150px]" placeholder="פרט כאן את שאלתך או הבעיה שנתקלת בה..." />
            </div>
            <Button type="submit" className="w-full gap-2 h-12 text-lg font-bold" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 rotate-180" />}
              שליחת הודעה
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

