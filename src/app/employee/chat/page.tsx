import { createClient } from '@/lib/supabase/server'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { MessageSquare } from 'lucide-react'

export const metadata = { title: 'צ׳אט עם המנהל | Nehemiah OS' }

export default async function EmployeeChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: conversations } = await supabase
    .from('conversations')
    .select('*, profiles:admin_id(id, full_name, avatar_url)')
    .eq('employee_id', user!.id)

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-xl">צ׳אט עם המנהל</h2>
          <p className="text-muted-foreground text-sm">שיחה פרטית וישירה עם הנהלת המשרד</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <ChatInterface
          initialConversations={conversations ?? []}
          currentUserId={user!.id}
          isAdmin={false}
        />
      </div>
    </div>
  )
}

