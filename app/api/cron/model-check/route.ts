import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { notifyCronFailure } from '@/lib/cron-notify'

const resend = new Resend(process.env.RESEND_API_KEY)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const INVENTORY = [
  { route: 'app/api/chat/route.ts (hoofdchat, streaming)', model: 'claude-sonnet-4-6', reden: 'Sonnet 5 teruggedraaid: geen text block bij thinking mode op lange vragen. Retry+fallback na streaming toegevoegd' },
  { route: 'app/api/chat/route.ts (RAG-queryherschrijving/checks)', model: 'claude-haiku-4-5-20251001', reden: 'Korte classificatie/herschrijfstappen, expliciete fallbacks' },
  { route: 'app/api/bot/uitdaging/route.ts', model: 'claude-fable-5', reden: 'Grammaticale kwaliteit en voortgangsherkenning vereisen Fable. Retry-bij-leeg-antwoord toegevoegd' },
  { route: 'app/api/bot/session-end/route.ts (synthese/feiten/uitdaging)', model: 'claude-haiku-4-5-20251001', reden: 'Drie parallelle batch-calls per sessie, elk met retry-bij-leeg-antwoord' },
  { route: 'app/api/bot/coaching/route.ts (precheck)', model: 'claude-sonnet-5', reden: 'Ja/nee vraag, Fable 5 overkill' },
  { route: 'app/api/bot/coaching/route.ts (hoofdsynthese)', model: 'claude-fable-5', reden: 'Hoogste kwaliteit voor de belangrijkste synthese' },
  { route: 'app/api/bot/coaching/route.ts (blog-synthese)', model: 'claude-haiku-4-5-20251001', reden: 'Korte labels per blog' },
  { route: 'app/api/bot/coaching-analyse/route.ts (BIEB)', model: 'claude-sonnet-4-6', reden: 'Was Sonnet 5, gaf soms lege analyse terug (2026-07 gefixt)' },
  { route: 'app/api/bot/team/spotlight/route.ts', model: 'claude-sonnet-4-6', reden: 'Zelfde migratie/reden als coaching-analyse' },
  { route: 'app/api/bot/team/1on1/route.ts', model: 'claude-haiku-4-5-20251001', reden: 'Sonnet 5 teruggedraaid: kapte output af midden in een zin' },
  { route: 'app/api/sparring/debrief/route.ts', model: 'claude-sonnet-4-6', reden: 'Was Sonnet 5, bevestigde bug: lege debrief bij lange transcripten (2026-07 gefixt)' },
  { route: 'app/api/sparring/chat/route.ts', model: 'claude-sonnet-4-6', reden: 'Zelfde sessie/oorzaak als sparring/debrief' },
  { route: 'app/api/cron/auto-analyse/route.ts', model: 'claude-sonnet-4-6', reden: 'Was Sonnet 5, zelfde risico als coaching-analyse (2026-07 gefixt)' },
  { route: 'app/api/admin/analyse-evaluaties/route.ts', model: 'claude-sonnet-4-6', reden: 'Was Sonnet 5 (2026-07 gefixt)' },
  { route: 'app/api/bot/coaching-precheck/route.ts', model: 'claude-sonnet-4-6', reden: 'Losse ja/nee-check, expliciete fallback' },
  { route: 'app/api/bot/verfijn/route.ts', model: 'claude-sonnet-4-6', reden: 'Herschrijft gebruikersvraag, expliciete fallback' },
  { route: 'app/api/bot/search-linkedin-profile/route.ts', model: 'claude-sonnet-4-6', reden: 'Opzoektaak met web_search tool' },
  { route: 'app/api/bot/sessions/route.ts', model: 'claude-haiku-4-5-20251001', reden: 'Nog niet beoordeeld op leeg-antwoord-risico' },
  { route: 'app/api/bot/sessions/search/route.ts', model: 'claude-haiku-4-5-20251001', reden: 'JSON-fallback bij parse-fout' },
  { route: 'app/api/cron/refresh-openers/route.ts', model: 'claude-sonnet-4-6', reden: 'Expliciete JSON-structuurcheck aanwezig' },
  { route: 'app/api/cron/rss-ingest/route.ts', model: 'claude-haiku-4-5-20251001', reden: 'Expliciete fallback-tekst aanwezig' },
  { route: 'app/api/cron/inactivity-nudge/route.ts', model: 'claude-haiku-4-5-20251001', reden: 'Valt terug op generieke e-mailtemplate bij fout' },
  { route: 'app/api/admin/feedback-analyse/route.ts', model: 'claude-haiku-4-5-20251001', reden: 'Nog geen expliciete leeg-check' },
  { route: 'app/api/admin/blogs-analyse/route.ts', model: 'claude-sonnet-4-6', reden: 'Retry-bij-leeg-antwoord toegevoegd, foutrespons i.p.v. lege analyse' },
  { route: 'app/api/admin/meta-analyse/route.ts (zelfbeoordeling + expertpanel)', model: 'claude-sonnet-4-6', reden: 'Retry-bij-leeg-antwoord toegevoegd, foutrespons i.p.v. lege analyse' },
  { route: 'app/api/cron/meta-analyse/route.ts (zelfbeoordeling + expertpanel)', model: 'claude-sonnet-4-6', reden: 'Retry-bij-leeg-antwoord toegevoegd, overgeslagen i.p.v. lege analyse' },
  { route: 'app/api/admin/test-email/route.ts', model: 'claude-haiku-4-5-20251001', reden: 'Admin-testtool, geen gebruikersgerichte output' },
  { route: 'lib/rag.ts (queryherschrijving RAG)', model: 'claude-haiku-4-5-20251001', reden: 'Eenvoudige herschrijftaak' },
  { route: 'scripts/embed-chunks.mjs (contextgeneratie)', model: 'claude-haiku-4-5-20251001', reden: 'Offline kennisbank-ingest, fallback-tekst aanwezig' },
  { route: 'scripts/translate-knowledge-base.mjs', model: 'claude-opus-4-8', reden: 'Offline vertaalscript, enige Opus-gebruik in de codebase' },
]

type AdviesMap = Record<string, { actie: 'blijven' | 'overwegen' | 'switchen'; tekst: string }>

async function getAdviezen(): Promise<AdviesMap> {
  const inventarisText = INVENTORY.map(i =>
    `- ${i.route}: huidig model ${i.model} (${i.reden})`
  ).join('\n')

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: 'Je bent een technisch adviseur voor een productie-app die draait op Anthropic-modellen. Je geeft per route een beknopt advies op basis van de nieuwste beschikbare modellen en prijs/kwaliteitsverhouding. Wees direct en concreet.',
    messages: [{
      role: 'user',
      content: `Dit zijn de huidige modelkeuzes voor ArnoBot, een sales coaching chatbot:\n\n${inventarisText}\n\nBeschikbare Anthropic modellen (meest recent): Fable 5 ($10/$50 per 1M tokens, reasoning), Opus 4.8 ($5/$25, sterk), Sonnet 4.6 ($3/$15, gebalanceerd), Haiku 4.5 ($1/$5, snel/goedkoop).\n\nGeef per route een advies. Return als JSON array:\n[{"route": "exacte route naam", "actie": "blijven|overwegen|switchen", "tekst": "één zin advies max 12 woorden"}]`
    }]
  })

  const raw = getText(res.content, '[]')
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return {}

  const parsed: { route: string; actie: 'blijven' | 'overwegen' | 'switchen'; tekst: string }[] = JSON.parse(match[0])
  const map: AdviesMap = {}
  for (const item of parsed) {
    map[item.route] = { actie: item.actie, tekst: item.tekst }
  }
  return map
}

function actiekleur(actie: 'blijven' | 'overwegen' | 'switchen'): string {
  if (actie === 'blijven') return '#4ade80'
  if (actie === 'overwegen') return '#f59e0b'
  return '#f87171'
}

function buildEmail(date: string, adviezen: AdviesMap): string {
  const rows = INVENTORY.map(item => {
    const advies = adviezen[item.route]
    const adviesHtml = advies
      ? `<span style="color: ${actiekleur(advies.actie)}; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 2px;">${advies.actie}</span><br><span style="color: #9ca3af;">${advies.tekst}</span>`
      : '<span style="color: #4b5563;">n.v.t.</span>'

    return `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #374151; color: #9ca3af; font-size: 13px; font-family: Arial,-apple-system,sans-serif; vertical-align: top;">${item.route}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #374151; color: #f59e0b; font-size: 13px; font-family: Arial,-apple-system,sans-serif; white-space: nowrap; vertical-align: top;">${item.model}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #374151; color: #6b7280; font-size: 13px; font-family: Arial,-apple-system,sans-serif; vertical-align: top;">${item.reden}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #374151; font-size: 13px; font-family: Arial,-apple-system,sans-serif; vertical-align: top;">${adviesHtml}</td>
    </tr>
  `}).join('')

  return `
    <div style="background: #111827; color: #f1f5f9; padding: 48px 40px 40px; max-width: 800px; margin: 0 auto; font-family: Arial,-apple-system,sans-serif;">
      <p style="font-family:'Arial Black',Arial,Impact,sans-serif;font-size:26px;letter-spacing:6px;margin:0 0 32px;line-height:1;"><span style="color:#f1f5f9;">ARNO</span><span style="color:#f59e0b;">BOT</span></p>
      <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 4px; color: #f1f5f9;">MAANDELIJKSE MODELCHECK</h1>
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 32px;">${date}</p>

      <p style="color: #9ca3af; font-size: 14px; line-height: 1.8; margin: 0 0 24px;">
        Automatische check op huidige modelkeuzes. Het advies is gegenereerd door Claude op basis van bekende modellen en prijs/kwaliteit.<br>
        Controleer altijd zelf de Anthropic pricing voor de laatste stand.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 8px 12px; color: #f59e0b; font-size: 11px; letter-spacing: 3px; border-bottom: 2px solid #374151;">ROUTE</th>
            <th style="text-align: left; padding: 8px 12px; color: #f59e0b; font-size: 11px; letter-spacing: 3px; border-bottom: 2px solid #374151;">MODEL</th>
            <th style="text-align: left; padding: 8px 12px; color: #f59e0b; font-size: 11px; letter-spacing: 3px; border-bottom: 2px solid #374151;">REDEN</th>
            <th style="text-align: left; padding: 8px 12px; color: #f59e0b; font-size: 11px; letter-spacing: 3px; border-bottom: 2px solid #374151;">ADVIES</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <p style="color: #6b7280; font-size: 13px; line-height: 1.8; margin: 0 0 8px;">
        Na een wijziging: update CLAUDE.md (modelinventaris-tabel) en de INVENTORY in deze route.
      </p>
      <p style="color: #6b7280; font-size: 13px;">
        Prijzen: <a href="https://platform.claude.com/docs/en/about-claude/pricing" style="color: #f59e0b;">platform.claude.com/docs/pricing</a>
      </p>
    </div>
  `
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = new Date().toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam',
  })

  let adviezen: AdviesMap = {}
  try {
    adviezen = await getAdviezen()
  } catch (e) {
    console.error('[model-check] advies genereren mislukt:', e)
  }

  try {
    await resend.emails.send({
      from: 'Arno <arno@arno.bot>',
      to: 'model@arno.bot',
      subject: `Modelcheck ${date}`,
      html: buildEmail(date, adviezen),
    })
    return NextResponse.json({ ok: true, sent: date })
  } catch (e) {
    await notifyCronFailure('model-check', e)
    return NextResponse.json({ error: 'send_failed' }, { status: 500 })
  }
}
