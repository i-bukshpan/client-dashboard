import { createClient } from '@/lib/supabase/server'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { MessageSquare } from 'lucide-react'

export const metadata = { title: 'צ׳אט פנימי | Nehemiah OS' }

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch all employees so the admin can start a new conversation
  const { data: employees } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('role', 'employee')
    .order('full_name')

  // Fetch existing conversations
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*, profiles:employee_id(id, full_name, avatar_url)')
    .or(`admin_id.eq.${user!.id},employee_id.eq.${user!.id}`)

  const isAdmin = true // In admin layout, this is guaranteed

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-xl">צ׳אט צוות פנימי</h2>
          <p className="text-muted-foreground text-sm">שיחות פרטיות עם חברי הצוות</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <ChatInterface
          initialConversations={conversations ?? []}
          allEmployees={employees ?? []}
          currentUserId={user!.id}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  )
}

