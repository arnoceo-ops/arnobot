import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { notifyCronFailure } from '@/lib/cron-notify'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const html = `
    <div style="background:#111827;color:#f1f5f9;padding:48px 40px 40px;max-width:560px;margin:0 auto;font-family:Arial,-apple-system,sans-serif;">
      <p style="font-family:'Arial Black',Arial,Impact,sans-serif;font-size:26px;letter-spacing:6px;margin:0 0 40px;line-height:1;">
        <span style="color:#f1f5f9;">ARNO</span><span style="color:#f59e0b;">BOT</span>
      </p>

      <p style="margin:0 0 20px;font-family:Arial,-apple-system,sans-serif;font-size:16px;font-weight:700;color:#f1f5f9;">Hey, Arno.</p>

      <div style="font-family:Arial,-apple-system,sans-serif;font-size:15px;color:#9ca3af;line-height:1.8;margin:0 0 36px;">
        <p style="margin:0 0 16px;">Over 4 dagen draait de maandelijkse meta-analyse. ArnoBot wordt beoordeeld door het panel van zes.</p>
        <p style="margin:0 0 16px;">Jij bent het zesde panellid. Als je er nu je observaties in zet, staan jouw eigen woorden in de analyse. Wat viel je op in de antwoorden van ArnoBot deze maand? Waar was hij te voorzichtig? Waar miste hij jouw stem?</p>
        <p style="margin:0;">Zonder input genereert de AI een Arno-beoordeling voor je. Maar dat is niet hetzelfde.</p>
      </div>

      <a href="https://arno.bot/bot/admin/meta-analyse"
        style="display:inline-block;background:#f59e0b;color:#111827;font-family:Arial,-apple-system,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.5px;padding:12px 24px;text-decoration:none;border-radius:999px;">
        VELDEN INVULLEN →
      </a>

      <p style="margin:48px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#374151;">© ARNOBOT</p>
    </div>
  `

  try {
    await resend.emails.send({
      from: 'ArnoBot <arno@arno.bot>',
      to: 'arno@arno.bot',
      subject: 'Meta-analyse over 4 dagen, vul je input in',
      html,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    await notifyCronFailure('meta-analyse-reminder', e)
    return NextResponse.json({ error: 'send_failed' }, { status: 500 })
  }
}
