// Fable 5 draait individuele calls aantoonbaar trager dan Sonnet, dus meer ruimte dan de
// oorspronkelijke 60s nodig sinds de modelwissel (2026-08-18).
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { notifyCronFailure } from '@/lib/cron-notify'
import { runMetaAnalyse } from '@/lib/metaAnalyse'
import { stripBevindingenBlok } from '@/lib/metaAnalyseTrend'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function textToHtml(text: string): string {
  const blocks = text.split(/\n{2,}/)
  return blocks.map(block => {
    const trimmed = block.trim()
    if (!trimmed) return ''
    if (/^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ\s\/0-9]+$/.test(trimmed) && trimmed.length < 60) {
      return `<p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#f59e0b;margin:24px 0 8px 0;">${trimmed}</p>`
    }
    const lines = trimmed.split('\n').map(line => {
      if (line.startsWith('Kritisch punt:')) {
        return `<span style="color:#f59e0b;">Kritisch punt:</span>${line.slice('Kritisch punt:'.length)}`
      }
      if (line.startsWith('Score:') || line.startsWith('OVERALL SCORE:') || line.startsWith('PANEL CONSENSUS:') || line.startsWith('PRIORITEIT 1:')) {
        return `<strong style="color:#f1f5f9;">${line}</strong>`
      }
      return line
    }).join('<br>')
    return `<p style="font-family:Arial,-apple-system,sans-serif;font-size:14px;color:#9ca3af;line-height:1.8;margin:0 0 16px 0;">${lines}</p>`
  }).join('')
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resultaat = await runMetaAnalyse(supabase, { days: 30 })

    if (resultaat.status === 'geen_gesprekken') {
      return NextResponse.json({ skipped: true, reden: 'geen gesprekken' })
    }
    if (resultaat.status === 'genereren_mislukt') {
      await notifyCronFailure('meta-analyse', new Error('Leeg AI-antwoord na retry, analyse overgeslagen'))
      return NextResponse.json({ error: 'genereren_mislukt' }, { status: 500 })
    }

    const { zelfbeoordeling, expertpanel, jouwAnalyse, sessieCount } = resultaat
    const date = new Date().toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam',
    })

    const html = `
      <div style="background:#111827;color:#f1f5f9;padding:48px 40px 40px;max-width:800px;margin:0 auto;font-family:Arial,-apple-system,sans-serif;">
        <p style="font-family:'Arial Black',Arial,Impact,sans-serif;font-size:26px;letter-spacing:6px;margin:0 0 32px;line-height:1;"><span style="color:#f1f5f9;">ARNO</span><span style="color:#f59e0b;">BOT</span></p>
        <h1 style="font-size:28px;font-weight:700;margin:0 0 4px;color:#f1f5f9;">MAANDELIJKSE META-ANALYSE</h1>
        <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">${date}</p>
        <p style="color:#6b7280;font-size:13px;margin:0 0 40px;">${sessieCount} gesprekken geanalyseerd</p>

        <h2 style="font-size:16px;font-weight:700;color:#f1f5f9;margin:0 0 16px;letter-spacing:2px;">ZELFBEOORDELING</h2>
        ${textToHtml(zelfbeoordeling)}

        <div style="border-top:1px solid #374151;margin:32px 0;"></div>

        <h2 style="font-size:16px;font-weight:700;color:#f1f5f9;margin:0 0 16px;letter-spacing:2px;">EXPERTPANEL</h2>
        ${textToHtml(stripBevindingenBlok(expertpanel))}

        ${jouwAnalyse ? `
        <div style="border-top:1px solid #374151;margin:32px 0;"></div>

        <h2 style="font-size:16px;font-weight:700;color:#f1f5f9;margin:0 0 16px;letter-spacing:2px;">JOUW ANALYSE</h2>
        ${textToHtml(jouwAnalyse)}
        ` : ''}

        <div style="border-top:1px solid #374151;margin:32px 0;"></div>
        <p style="color:#6b7280;font-size:13px;">Bekijk de volledige analyse op <a href="https://arno.bot/bot/admin/meta-analyse" style="color:#f59e0b;">arno.bot/bot/admin/meta-analyse</a></p>
        <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#374151;">© ARNOBOT</p>
      </div>
    `

    await resend.emails.send({
      from: 'ArnoBot <arno@arno.bot>',
      to: 'arno@arno.bot',
      subject: `Meta-analyse ArnoBot ${date}`,
      html,
    })

    return NextResponse.json({ ok: true, sessies: sessieCount })
  } catch (e) {
    await notifyCronFailure('meta-analyse', e)
    return NextResponse.json({ error: 'mislukt' }, { status: 500 })
  }
}
