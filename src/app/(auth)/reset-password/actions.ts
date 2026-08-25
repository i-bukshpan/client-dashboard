'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function resetPasswordServerAction(password: string) {
  if (!password || password.length < 6) {
    return { error: 'הסיסמה חייבת להכיל לפחות 6 תווים' }
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (user && !userError) {
      // Try updating via session
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (!updateError) {
        return { success: true }
      }

      // Fallback via admin client using verified session user id
      const { error: adminError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password,
      })
      if (!adminError) {
        return { success: true }
      }

      return { error: updateError.message || adminError?.message || 'שגיאה בעדכון הסיסמה' }
    }

    return { error: 'פג תוקף החיבור לאיפוס סיסמה. אנא בקש קישור חדש.' }
  } catch (err: any) {
    console.error('Password reset server error:', err)
    return { error: err?.message || 'שגיאה בעיבוד הבקשה' }
  }
}
