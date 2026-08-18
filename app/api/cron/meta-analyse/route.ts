export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { notifyCronFailure } from '@/lib/cron-notify'
import { ARNOBOT_MANDAAT } from '@/lib/systemPrompt'
import { E2E_TEST_USER_ID, MANUAL_TEST_USER_ID, APP_REVIEWER_ID } from '@/lib/internalTestAccounts'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

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

  const days = 30
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const ownerUserId = process.env.ARNOBOT_OWNER_USER_ID

  try {
    // Sessies ophalen
    let sessieQuery = supabase
      .from('arnobot_blog_sessions')
      .select('session_id, title, summary')
      .gte('created_at', since)
      .not('session_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(12)
      .neq('user_id', E2E_TEST_USER_ID)
      .neq('user_id', MANUAL_TEST_USER_ID)
      .neq('user_id', APP_REVIEWER_ID)
    if (ownerUserId) sessieQuery = sessieQuery.neq('user_id', ownerUserId)
    const { data: sessies } = await sessieQuery

    if (!sessies?.length) {
      return NextResponse.json({ skipped: true, reden: 'geen gesprekken' })
    }

    // Arno's eigen input ophalen (max 45 dagen oud)
    const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
    const { data: arnoInput } = await supabase
      .from('arnobot_meta_input')
      .select('content, created_at')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const arnoInputTekst = arnoInput?.content ?? null

    const sessionIds = sessies.map(s => s.session_id).filter(Boolean) as string[]

    let logsQuery = supabase
      .from('arnobot_rds_logs')
      .select('session_id, question, answer, created_at')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true })
    if (ownerUserId) logsQuery = logsQuery.neq('user_id', ownerUserId)
    const { data: logs } = await logsQuery

    const bySession: Record<string, { question: string; answer: string }[]> = {}
    for (const log of logs ?? []) {
      if (!bySession[log.session_id]) bySession[log.session_id] = []
      if (bySession[log.session_id].length < 5) {
        bySession[log.session_id].push({ question: log.question, answer: log.answer })
      }
    }

    const rijkeSessies = sessies.filter(s => (bySession[s.session_id]?.length ?? 0) > 0)
    if (!rijkeSessies.length) {
      return NextResponse.json({ skipped: true, reden: 'geen gesprekken met inhoud' })
    }

    const transcripts = rijkeSessies
      .map((s, i) => {
        const exchanges = bySession[s.session_id]
          .map(e => `GEBRUIKER: ${e.question}\n\nARNO: ${e.answer}`)
          .join('\n\n---\n\n')
        return `GESPREK ${i + 1}${s.title ? ` (${s.title})` : ''}:\n\n${exchanges}`
      })
      .join('\n\n====\n\n')

    const sessieCount = rijkeSessies.length

    const callZelfModel = () => anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: `Je analyseert gesprekken van ArnoBot als kritische zelfreflectie. Schrijf vanuit het perspectief van ArnoBot zelf. Wees eerlijk en specifiek. ${ARNOBOT_MANDAAT} Gebruik NOOIT een streepje als leesteken.`,
      messages: [{
        role: 'user',
        content: `${sessieCount} gesprekken van de afgelopen maand:\n\n${transcripts}\n\nZelfbeoordeling in vier blokken:\n\nWAAR IK STERK WAS\n[minimaal 3 concrete observaties]\n\nWAAR IK TEKORT SCHOOT\n[minimaal 3 specifieke punten]\n\nKENNISHIATEN\n[specifieke terreinen waar diepgang ontbrak]\n\nWAT IK ZOU VERBETEREN\n[minimaal 3 concrete aanbevelingen]`,
      }],
    })
    const callPanelModel = () => anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: `Je coördineert een expertpanel dat ArnoBot beoordeelt als salescoach. Elk jurylid spreekt in de ik-vorm vanuit zijn eigen filosofie. Wees kritisch en specifiek. ${ARNOBOT_MANDAAT} Gebruik NOOIT een streepje als leesteken.`,
      messages: [{
        role: 'user',
        content: `${sessieCount} echte gesprekken van de afgelopen maand:\n\n${transcripts}\n\nMARSHALL GOLDSMITH\nScore: [X]/10\n[Oordeel: gedragsverandering, accountability, vraag achter de vraag]\nKritisch punt: [één aanbeveling]\n\nTONY ROBBINS\nScore: [X]/10\n[Oordeel: state, grotere visie, threats naar opportunities]\nKritisch punt: [één aanbeveling]\n\nELON MUSK\nScore: [X]/10\n[Oordeel: first principles, direct toepasbaar, geen omhaal]\nKritisch punt: [één aanbeveling]\n\nDANIEL KAHNEMAN\nScore: [X]/10\n[Oordeel: System 1 vs 2, emotionele drijfveren, gedragspsychologie]\nKritisch punt: [één aanbeveling]\n\nJORDAN BELFORT\nScore: [X]/10\n[Oordeel: commerciële scherpte, veldklaar advies, deals sluiten]\nKritisch punt: [één aanbeveling]\n\n${arnoInputTekst
  ? `ARNO DIEPEVEEN\n(Oprichter Royal Dutch Sales. Arno heeft zijn eigen observaties aangeleverd over wat ArnoBot zei in zijn antwoorden. Verwerk zijn input als een juryoordeel.)\nArno\'s eigen aantekeningen: "${arnoInputTekst}"\nScore: [X]/10\n[Verwerk Arno\'s observaties in een concreet oordeel op de gesprekken]\nKritisch punt: [één concrete aanbeveling die voortbouwt op zijn aantekeningen]`
  : `ARNO DIEPEVEEN\n(Oprichter Royal Dutch Sales. Geen eigen input deze maand. Beoordeel op basis van de gesprekken: is dit zijn stem, zijn directheid, zijn timing?)\nScore: [X]/10\n[Oordeel: toon, authenticiteit, aanpak]\nKritisch punt: [één aanbeveling om ArnoBot dichter bij de echte Arno te brengen]`
}\n\nOVERALL SCORE: [gemiddelde van zes scores]/10\nPANEL CONSENSUS: [één zin]\nPRIORITEIT 1: [meest impactvolle verbeterpunt]`,
      }],
    })

    const [zelfResponse, panelResponse] = await Promise.all([callZelfModel(), callPanelModel()])

    let zelfbeoordeling = getText(zelfResponse.content)
    let expertpanel = getText(panelResponse.content)

    if (!zelfbeoordeling) {
      console.error('[cron/meta-analyse] lege zelfbeoordeling, retry')
      zelfbeoordeling = getText(await callZelfModel().then(r => r.content))
    }
    if (!expertpanel) {
      console.error('[cron/meta-analyse] leeg expertpanel, retry')
      expertpanel = getText(await callPanelModel().then(r => r.content))
    }
    if (!zelfbeoordeling || !expertpanel) {
      await notifyCronFailure('meta-analyse', new Error('Leeg AI-antwoord na retry, analyse overgeslagen'))
      return NextResponse.json({ error: 'genereren_mislukt' }, { status: 500 })
    }

    await supabase
      .from('arnobot_meta_analyses')
      .insert({ period_days: days, session_count: sessieCount, zelfbeoordeling_text: zelfbeoordeling, expertpanel_text: expertpanel })

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
        ${textToHtml(expertpanel)}

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
