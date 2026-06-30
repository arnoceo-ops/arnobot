import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { naam, frequentie, onderdelen, waardevol, ontbreekt, persona, personaAnders, tariefstelling, aanbevelen, aanbevelenToelichting, referentie, referentieTekst, slotwoord } = body

  const { error } = await supabase.from('arnobot_evaluaties').insert({
    naam: naam || null,
    frequentie,
    onderdelen,
    waardevol: waardevol || null,
    ontbreekt: ontbreekt || null,
    persona,
    persona_anders: personaAnders || null,
    tariefstelling: tariefstelling || null,
    aanbevelen,
    aanbevelen_toelichting: aanbevelenToelichting || null,
    referentie: referentie || null,
    referentie_tekst: referentieTekst || null,
    slotwoord: slotwoord || null,
  })

  if (error) {
    console.error('Evaluatie insert error:', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }

  const r = (label: string, val: string | string[] | undefined) => {
    if (!val || (Array.isArray(val) && val.length === 0)) return ''
    const v = Array.isArray(val) ? val.join(', ') : val
    return `<tr><td style="padding:8px 16px 8px 0;color:#9ca3af;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:8px 0;color:#f1f5f9">${v}</td></tr>`
  }

  await resend.emails.send({
    from: 'ArnoBot <noreply@arno.bot>',
    to: 'evaluatie@arno.bot',
    subject: `Evaluatie van ${naam || 'onbekend'}`,
    html: `
      <div style="background:#111827;padding:48px 40px 40px;font-family:Arial,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f1f5f9;max-width:560px;margin:0 auto;">
        <p style="font-family:'Arial Black',Arial,Impact,sans-serif;font-size:26px;letter-spacing:6px;margin:0 0 32px;line-height:1;"><span style="color:#f1f5f9;">ARNO</span><span style="color:#f59e0b;">BOT</span></p>
        <p style="font-size:20px;font-weight:700;color:#f1f5f9;margin:0 0 32px;">Nieuwe evaluatie</p>
        <table style="width:100%;border-collapse:collapse">
          ${r('Naam', naam)}
          ${r('Frequentie', frequentie)}
          ${r('Onderdelen', onderdelen)}
          ${r('Waardevol', waardevol)}
          ${r('Ontbreekt', ontbreekt)}
          ${r('Doelgroep', persona)}
          ${personaAnders ? r('Anders', personaAnders) : ''}
          ${r('Tariefstelling', tariefstelling)}
          ${r('Aanbevelen', aanbevelen)}
          ${aanbevelenToelichting ? r('Toelichting', aanbevelenToelichting) : ''}
          ${referentie ? r('User reference', referentie) : ''}
          ${referentieTekst ? r('Aanbeveling', referentieTekst) : ''}
          ${slotwoord ? r('Slotwoord', slotwoord) : ''}
        </table>
      </div>
    `,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
