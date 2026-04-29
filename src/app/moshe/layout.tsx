import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MosheSidebar } from '@/components/moshe/MosheSidebar'

export default async function MosheLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
  const isMoshe = user.email === process.env.MOSHE_EMAIL

  if (!isAdmin && !isMoshe) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if ((profile as any)?.role !== 'admin') redirect('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a]" dir="rtl">
      <MosheSidebar isAdmin={isAdmin} />
      <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center px-6 gap-4 shrink-0 shadow-sm">
          <div className="flex-1">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">פורטל ניהול</p>
            <p className="text-sm font-bold text-slate-800 leading-none">משה פרוש — פרויקטי נדל"ן</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <a
                href="/admin/dashboard"
                className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
              >
                ← חזרה לניהול
              </a>
            )}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              מפ
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
