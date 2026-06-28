import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { getEmailTemplate, getEmailTemplateList, type EmailType } from '@/lib/email-templates'

const resend = new Resend(process.env.RESEND_API_KEY)
const TO = 'arno@arno.bot'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ templates: getEmailTemplateList() })
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type } = await req.json()

  let template: { subject: string; html: string }
  try {
    template = getEmailTemplate(type as EmailType, 'Arno', true, { userId: process.env.ARNOBOT_OWNER_USER_ID ?? 'test-user-id' })
  } catch {
    return NextResponse.json({ error: 'Onbekend type' }, { status: 400 })
  }

  const { error } = await resend.emails.send({
    from: 'ArnoBot <info@arno.bot>',
    to: TO,
    subject: template.subject,
    html: template.html,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
