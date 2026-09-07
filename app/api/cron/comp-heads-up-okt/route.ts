import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getEmailTemplate } from '@/lib/email-templates'
import { notifyCronFailure } from '@/lib/cron-notify'

// Eenmalige heads-up (2026-09-02): de vier vroege testgebruikers hebben tot 1 november
// gratis toegang (comp via expires_at). Deze cron stuurt ze op vrijdag 16 oktober één
// mail dat de periode afloopt. Schema in vercel.json: "0 8 16 10 *".
//
// Wegwerpcode: na 17 oktober mag dit bestand + de vercel.json-regel eruit. Idempotent
// via de arnobot_meta-vlag, dus een tweede run (of een run in 2027) doet niets.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

const META_FLAG = 'comp_heads_up_okt_sent'
const DOELGROEP = [
  'rtesfahuny@hotmail.com',
  'charles.deklerk@xs4all.nl',
  'erik.van.den.berg@xs4all.nl',
  'dyannethornleeson@gmail.com',
]

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    // Alleen op of na 16 oktober 2026, en nooit in een later jaar.
    if (now < new Date('2026-10-16T00:00:00Z') || now.getUTCFullYear() !== 2026) {
      return NextResponse.json({ ok: true, skipped: 'buiten venster' })
    }

    const { data: flag } = await supabase
      .from('arnobot_meta')
      .select('value')
      .eq('key', META_FLAG)
      .maybeSingle()
    if (flag) return NextResponse.json({ ok: true, skipped: 'al verstuurd' })

    const { data: users, error } = await supabase
      .from('approved_users')
      .select('email, voornaam, is_active')
      .in('email', DOELGROEP)
    if (error) throw new Error(error.message)

    let sent = 0
    const overgeslagen: string[] = []
    for (const u of users ?? []) {
      if (!u.email || !u.is_active) { overgeslagen.push(u.email ?? '?'); continue }
      const { subject, html } = getEmailTemplate('testtoegang_afloop', u.voornaam || 'daar')
      await resend.emails.send({ from: 'ArnoBot <info@arno.bot>', to: u.email, subject, html })
      sent++
    }

    const ts = now.toISOString()
    await supabase.from('arnobot_meta').upsert([{ key: META_FLAG, value: ts, updated_at: ts }])

    return NextResponse.json({ ok: true, sent, overgeslagen })
  } catch (err) {
    await notifyCronFailure('comp-heads-up-okt', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
