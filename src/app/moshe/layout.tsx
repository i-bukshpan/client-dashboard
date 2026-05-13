import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as adminDb } from '@supabase/supabase-js'
import { MosheShell } from '@/components/moshe/MosheShell'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  manifest: '/moshe-manifest.json',
}

const db = adminDb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  // Load pending worker replies for the notification widget
  const { data: msgs } = await db
    .from('worker_messages')
    .select(`
      id, title, status, updated_at,
      replies:worker_message_replies(sender, body, created_at),
      worker:worker_id(name)
    `)
    .in('status', ['open', 'in_progress'])
    .order('updated_at', { ascending: false })

  const pendingReplies: {
    messageId: string; messageTitle: string; workerName: string
    lastReply: string; repliedAt: string
  }[] = []

  for (const msg of (msgs as any[]) ?? []) {
    const workerReplies = ((msg.replies ?? []) as any[]).filter((r: any) => r.sender === 'worker')
    if (workerReplies.length === 0) continue
    const last = [...workerReplies].sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))[0]
    pendingReplies.push({
      messageId:    msg.id,
      messageTitle: msg.title,
      workerName:   (msg.worker as any)?.name ?? 'עובד',
      lastReply:    last.body,
      repliedAt:    last.created_at,
    })
  }

  return (
    <MosheShell isAdmin={isAdmin} pendingReplies={pendingReplies}>
      {children}
    </MosheShell>
  )
}
