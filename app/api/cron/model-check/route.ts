import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import Anthropic from '@anthropic-ai/sdk'
import { stripDashPunctuation } from '@/lib/ai'
import { notifyCronFailure } from '@/lib/cron-notify'

export const maxDuration = 120

const resend = new Resend(process.env.RESEND_API_KEY)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const REPO = 'arnoceo-ops/arnobot'
const BRANCH = 'master'

type ModelRow = { route: string; model: string; reden: string; laatsteCheck: string }
type AdviesMap = Record<string, { actie: 'blijven' | 'overwegen' | 'switchen'; tekst: string }>

async function getClaudeMd(token: string): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/CLAUDE.md?ref=${BRANCH}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) return null
  const data = await res.json()
  return Buffer.from(data.content, 'base64').toString('utf8')
}

function extractModelsTable(claudeMd: string): string {
  const start = claudeMd.indexOf('## Model-inventaris')
  if (start === -1) return ''
  const section = claudeMd.slice(start)
  const tableStart = section.indexOf('| Route |')
  if (tableStart === -1) return ''
  const afterTable = section.slice(tableStart)
  // Tabel eindigt bij eerste lege regel na de tabelrijen
  const tableEnd = afterTable.search(/\n\s*\n[^|]/)
  const raw = tableEnd === -1 ? afterTable : afterTable.slice(0, tableEnd)
  return raw.trim()
}

function parseModelsTable(markdown: string): ModelRow[] {
  const rows: ModelRow[] = []
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('|')) continue
    if (/^\|[\s-]+\|/.test(line)) continue // scheidingsregel (|---|---|)
    const cells = line.slice(1, -1).split('|').map(c => c.trim().replace(/`/g, ''))
    if (cells.length < 4) continue
    if (cells[0] === 'Route') continue // headerregel
    rows.push({ route: cells[0], model: cells[1], reden: cells[2], laatsteCheck: cells[3] })
  }
  return rows
}

async function getAdviezen(rows: ModelRow[]): Promise<{ adviezen: AdviesMap; voorstel: string }> {
  const inventarisText = rows.map(r => `- ${r.route}: huidig model ${r.model} (${r.reden})`).join('\n')

  const prompt = `Dit zijn de huidige modelkeuzes voor ArnoBot, een sales coaching chatbot (bron: de modelinventaris-tabel in CLAUDE.md):

${inventarisText}

Zoek via web_search de meest actuele stand op van:
- Anthropic: modellenlijst/release notes op docs.anthropic.com en pricing op platform.claude.com/docs/pricing
- Voyage AI: modellen en pricing op docs.voyageai.com/docs/pricing (embedding- en rerank-modellen)

Vergelijk de huidige keuzes hierboven met wat je vindt. Let vooral op: nieuwe modelgeneraties, aangekondigde deprecations, en prijs/kwaliteitsverschillen. Kwaliteit weegt zwaarder dan prijs bij het advies.

Geef het resultaat terug als JSON, exact dit formaat, niets anders:
{"adviezen": [{"route": "exacte route-string uit de lijst hierboven", "actie": "blijven|overwegen|switchen", "tekst": "max 12 woorden"}], "voorstel": "platte tekst met voorgestelde wijzigingen voor de CLAUDE.md-modelinventaristabel, of \\"Geen wijzigingen nodig\\" als er niets te wijzigen is"}

Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst.
Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    })

    const text = stripDashPunctuation(
      res.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
    )
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as {
          adviezen: { route: string; actie: 'blijven' | 'overwegen' | 'switchen'; tekst: string }[]
          voorstel: string
        }
        const map: AdviesMap = {}
        for (const item of parsed.adviezen ?? []) {
          map[item.route] = { actie: item.actie, tekst: item.tekst }
        }
        return { adviezen: map, voorstel: parsed.voorstel || '' }
      } catch {
        // val door naar retry
      }
    }
  }
  return { adviezen: {}, voorstel: '' }
}

function actiekleur(actie: 'blijven' | 'overwegen' | 'switchen'): string {
  if (actie === 'blijven') return '#4ade80'
  if (actie === 'overwegen') return '#f59e0b'
  return '#f87171'
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildEmail(date: string, rows: ModelRow[], adviezen: AdviesMap, voorstel: string): string {
  const tableRows = rows.map(item => {
    const advies = adviezen[item.route]
    const adviesHtml = advies
      ? `<span style="color: ${actiekleur(advies.actie)}; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 2px;">${escapeHtml(advies.actie)}</span><br><span style="color: #9ca3af;">${escapeHtml(advies.tekst)}</span>`
      : '<span style="color: #4b5563;">n.v.t.</span>'

    return `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #374151; color: #9ca3af; font-size: 13px; font-family: Arial,-apple-system,sans-serif; vertical-align: top;">${escapeHtml(item.route)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #374151; color: #f59e0b; font-size: 13px; font-family: Arial,-apple-system,sans-serif; white-space: nowrap; vertical-align: top;">${escapeHtml(item.model)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #374151; color: #6b7280; font-size: 13px; font-family: Arial,-apple-system,sans-serif; vertical-align: top;">${escapeHtml(item.reden)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #374151; font-size: 13px; font-family: Arial,-apple-system,sans-serif; vertical-align: top;">${adviesHtml}</td>
    </tr>
  `}).join('')

  const voorstelHtml = voorstel && voorstel.trim() && !/^geen wijzigingen nodig$/i.test(voorstel.trim())
    ? `
      <p style="color: #f59e0b; font-size: 11px; letter-spacing: 3px; margin: 0 0 12px;">VOORGESTELDE WIJZIGING IN CLAUDE.MD</p>
      <p style="color: #9ca3af; font-size: 14px; line-height: 1.8; margin: 0 0 32px; white-space: pre-wrap;">${escapeHtml(voorstel)}</p>
    `
    : `<p style="color: #6b7280; font-size: 13px; margin: 0 0 32px;">Geen wijzigingen voorgesteld op basis van het live onderzoek.</p>`

  return `
    <div style="background: #111827; color: #f1f5f9; padding: 48px 40px 40px; max-width: 800px; margin: 0 auto; font-family: Arial,-apple-system,sans-serif;">
      <p style="font-family:'Arial Black',Arial,Impact,sans-serif;font-size:26px;letter-spacing:6px;margin:0 0 32px;line-height:1;"><span style="color:#f1f5f9;">ARNO</span><span style="color:#f59e0b;">BOT</span></p>
      <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 4px; color: #f1f5f9;">MAANDELIJKSE MODELCHECK</h1>
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 32px;">${date}</p>

      <p style="color: #9ca3af; font-size: 14px; line-height: 1.8; margin: 0 0 24px;">
        Automatische check op de huidige modelkeuzes. De modelinventaris is live opgehaald uit CLAUDE.md, het advies is gegenereerd door Claude op basis van een live zoekopdracht naar de actuele Anthropic- en Voyage AI-pricingpagina's, niet uit trainingskennis.<br><br>
        Controleer altijd zelf de bronnen voordat je iets doorvoert.
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
        <tbody>${tableRows}</tbody>
      </table>

      ${voorstelHtml}

      <p style="color: #6b7280; font-size: 13px; line-height: 1.8; margin: 0 0 8px;">
        Na een wijziging: update CLAUDE.md (modelinventaris-tabel). Deze cron leest die tabel voortaan live uit, dus geen aparte kopie meer om bij te houden.
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

  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    await notifyCronFailure('model-check', new Error('GITHUB_TOKEN niet geconfigureerd'))
    return NextResponse.json({ error: 'github_token_missing' }, { status: 500 })
  }

  let rows: ModelRow[]
  try {
    const claudeMd = await getClaudeMd(githubToken)
    if (!claudeMd) throw new Error('CLAUDE.md niet gevonden of niet leesbaar via GitHub API')
    rows = parseModelsTable(extractModelsTable(claudeMd))
    if (rows.length === 0) throw new Error('Modelinventaris-tabel leeg of niet gevonden in CLAUDE.md')
  } catch (e) {
    await notifyCronFailure('model-check', e)
    return NextResponse.json({ error: 'claude_md_fetch_failed' }, { status: 500 })
  }

  let adviezen: AdviesMap = {}
  let voorstel = ''
  try {
    const result = await getAdviezen(rows)
    adviezen = result.adviezen
    voorstel = result.voorstel
  } catch (e) {
    console.error('[model-check] advies genereren mislukt:', e)
  }

  try {
    await resend.emails.send({
      from: 'Arno <arno@arno.bot>',
      to: 'model@arno.bot',
      subject: `Modelcheck ${date}`,
      html: buildEmail(date, rows, adviezen, voorstel),
    })
    return NextResponse.json({ ok: true, sent: date })
  } catch (e) {
    await notifyCronFailure('model-check', e)
    return NextResponse.json({ error: 'send_failed' }, { status: 500 })
  }
}
