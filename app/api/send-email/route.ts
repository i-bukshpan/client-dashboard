import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  const emailUser = process.env.EMAIL_USER
  const emailPass = process.env.EMAIL_PASS

  if (!emailUser || !emailPass) {
    return NextResponse.json(
      { error: 'EMAIL_USER ו-EMAIL_PASS לא מוגדרים ב-.env.local' },
      { status: 500 }
    )
  }

  let body: { to: string; subject: string; body: string; fromName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 })
  }

  const { to, subject, body: emailBody, fromName } = body

  if (!to || !subject || !emailBody) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPass },
    })

    await transporter.sendMail({
      from: fromName ? `"${fromName}" <${emailUser}>` : emailUser,
      to,
      subject,
      text: emailBody,
      html: emailBody.replace(/\n/g, '<br/>'),
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Email send error:', err)
    return NextResponse.json({ error: err.message || 'שגיאה בשליחת המייל' }, { status: 500 })
  }
}
