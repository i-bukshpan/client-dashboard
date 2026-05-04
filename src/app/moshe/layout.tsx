import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MosheShell } from '@/components/moshe/MosheShell'

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
    <MosheShell isAdmin={isAdmin}>
      {children}
    </MosheShell>
  )
}
