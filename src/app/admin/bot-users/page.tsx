import { createClient } from '@/lib/supabase/server'
import { BotUsersClient } from '@/components/bot-users/BotUsersClient'

export const metadata = { title: 'ניהול הרשאות בוט | Nehemiah OS' }

export const dynamic = 'force-dynamic'

export default async function BotUsersPage() {
  const supabase = await createClient()

  const { data: contacts, error } = await supabase
    .from('bot_contacts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching bot contacts:', error)
  }

  return (
    <div className="max-w-5xl mx-auto py-6">
      <BotUsersClient contacts={contacts || []} />
    </div>
  )
}
