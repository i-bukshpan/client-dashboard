import { createClient } from '@/lib/supabase/server'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { MessageSquare } from 'lucide-react'

export const metadata = { title: 'צ׳אט פנימי | Nehemiah OS' }

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch all conversations for the admin, or just the one for an employee
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isAdmin = (profile as any)?.role === 'admin'

  const { data: conversations } = await supabase
    .from('conversations')
    .select('*, profiles:employee_id(id, full_name, avatar_url)')
    .or(`admin_id.eq.${user!.id},employee_id.eq.${user!.id}`)

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-xl">צ׳אט צוות פנימי</h2>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? 'שיחות פרטיות עם חברי הצוות' : 'שיחה פרטית עם המנהל'}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <ChatInterface
          initialConversations={conversations ?? []}
          currentUserId={user!.id}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  )
}

