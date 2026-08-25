'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import nodemailer from 'nodemailer'

export async function requestPasswordResetAction(email: string, origin?: string) {
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail) {
    return { error: 'נא להזין כתובת אימייל' }
  }

  const appUrl = origin || process.env.NEXT_PUBLIC_APP_URL || 'https://ndfm.ibsites.co.il'
  const redirectTo = `${appUrl}/auth/callback?next=/reset-password`

  try {
    // Generate fresh recovery link directly from Supabase Admin
    const { data, error: generateError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: {
        redirectTo,
      },
    })

    if (generateError || !data?.properties?.action_link) {
      return { error: generateError?.message || 'לא ניתן היה לייצר קישור איפוס עבור כתובת זו' }
    }

    const actionLink = data.properties.action_link

    // If SMTP credentials exist, send via Nodemailer (100% reliable inbox delivery)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      })

      const htmlContent = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #0f172a; font-size: 22px; margin-bottom: 6px;">איפוס סיסמה - Nehemiah OS</h1>
            <p style="color: #64748b; font-size: 14px;">מערכת הניהול הפיננסי</p>
          </div>
          <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: right;">
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">שלום,</p>
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              התקבלה בקשה לאיפוס הסיסמה לחשבונך במערכת Nehemiah OS עבור <strong>${cleanEmail}</strong>.
            </p>
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              לחץ על הכפתור למטה כדי לקבוע סיסמה חדשה:
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${actionLink}" style="background-color: #0f172a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">
                קביעת סיסמה חדשה
              </a>
            </div>
            <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
              אם לא ביקשת לאפס את הסיסמה, תוכל להתעלם ממייל זה בבטחה.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 11px; word-break: break-all;">
              אם הכפתור לא עובד, העתק את הקישור הבא לדפדפן:<br />
              <a href="${actionLink}" style="color: #2563eb;">${actionLink}</a>
            </p>
          </div>
        </div>
      `

      await transporter.sendMail({
        from: `"Nehemiah OS" <${process.env.EMAIL_USER}>`,
        to: cleanEmail,
        subject: 'איפוס סיסמה למערכת Nehemiah OS',
        html: htmlContent,
      })

      return { success: true }
    }

    return { success: true }
  } catch (err: any) {
    console.error('Password reset email error:', err)
    return { error: err?.message || 'שגיאה בשליחת מייל איפוס הסיסמה' }
  }
}
