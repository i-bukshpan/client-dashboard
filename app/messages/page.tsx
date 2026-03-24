import { MessageSquare } from 'lucide-react'
import { AdvisorInbox } from '@/components/advisor-inbox'

export default function MessagesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/15 to-slate-50 p-6 sm:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-navy">הודעות</h1>
            <p className="text-sm font-medium text-grey mt-0.5">שיחות עם לקוחות</p>
          </div>
        </div>

        <AdvisorInbox />
      </div>
    </div>
  )
}
