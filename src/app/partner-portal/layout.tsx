import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as adminDb } from '@supabase/supabase-js'
import { LogOut, Eye } from 'lucide-react'

const db = adminDb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: partner } = await db
    .from('moshe_partners')
    .select('id, name, portal_access')
    .eq('email', user.email)
    .eq('portal_access', true)
    .single()

  if (!partner) redirect('/login')

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
              <span className="text-white font-black text-xs">{partner.name[0]}</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{partner.name}</p>
              <p className="text-[10px] text-slate-400 flex items-center gap-0.5">
                <Eye className="w-3 h-3" /> פורטל שותף · צפייה בלבד
              </p>
            </div>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
              התנתקות
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
