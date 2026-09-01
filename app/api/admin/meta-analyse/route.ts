export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type { Message } from '@anthropic-ai/sdk/resources'
import { getText } from '@/lib/ai'
import { ARNOBOT_MANDAAT } from '@/lib/systemPrompt'
import { E2E_TEST_USER_ID, MANUAL_TEST_USER_ID, APP_REVIEWER_ID } from '@/lib/internalTestAccounts'
import { fetchVorigeAnalyse, vorigPanelBlok, vorigZelfBlok, TREND_PANEL_INSTRUCTIE, TREND_ZELF_INSTRUCTIE } from '@/lib/metaAnalyseTrend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function extractText(response: Message, label: string): string {
  if (response.stop_reason === 'refusal') {
    console.error(`[admin/meta-analyse] ${label} refusal`)
    return ''
  }
  return getText(response.content)
}

// Hoeveel gesprekken meegenomen worden schaalt met de gekozen periode, i.p.v. altijd
// hard op 12 (dat maakte "kwartaal" kiezen zinloos zodra de laatste week al 12+ gesprekken had).
function conversationCap(days: number): number {
  if (days <= 7) return 15
  if (days <= 30) return 25
  if (days <= 90) return 40
  return Math.min(60, Math.round(days / 2))
}

// Basiswaarden voor max_tokens per call. Bij afkapping (stop_reason 'max_tokens') wordt
// eenmalig geretryt met het dubbele budget, ver binnen Fable 5's 128K-outputplafond.
const ZELF_MAX_TOKENS = 12000
const PANEL_MAX_TOKENS = 16000
const JOUW_ANALYSE_MAX_TOKENS = 10000

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  return token === process.env.ARNOBOT_ADMIN_KEY
}

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('arnobot_meta_analyses')
    .select('id, created_at, session_count, period_days, zelfbeoordeling_text, expertpanel_text, jouw_analyse_text')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/meta-analyse]', error.message)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Geen id opgegeven' }, { status: 400 })

  const { error } = await supabase.from('arnobot_meta_analyses').delete().eq('id', id)
  if (error) {
    console.error('[admin/meta-analyse] verwijderen mislukt:', error.message)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { days = 30 } = await req.json().catch(() => ({}))
  const cap = conversationCap(days)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const ownerUserId = process.env.ARNOBOT_OWNER_USER_ID

  // Stap 1: haal recente sessies op (ruimer dan de cap zodat we na filteren genoeg overhouden)
  let sessieQuery = supabase
    .from('arnobot_blog_sessions')
    .select('session_id, title, summary, user_id')
    .gte('created_at', since)
    .not('session_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(cap * 3)
    .neq('user_id', E2E_TEST_USER_ID)
    .neq('user_id', MANUAL_TEST_USER_ID)
    .neq('user_id', APP_REVIEWER_ID)

  if (ownerUserId) sessieQuery = sessieQuery.neq('user_id', ownerUserId)
  const { data: alleSessies } = await sessieQuery

  if (!alleSessies?.length) {
    return NextResponse.json({ zelfbeoordeling: null, expertpanel: null, count: 0, id: null })
  }

  // Filter op goedgekeurde ArnoBot-gebruikers — sluit arno.blog widget en Sales Canvas uit
  const kandidaatUserIds = [...new Set(alleSessies.map(s => s.user_id).filter(Boolean) as string[])]
  const { data: goedgekeurdeGebruikers } = kandidaatUserIds.length > 0
    ? await supabase.from('approved_users').select('user_id, voornaam, achternaam').in('user_id', kandidaatUserIds)
    : { data: [] }

  const naamMap: Record<string, string> = {}
  const goedgekeurdeIds = new Set<string>()
  for (const u of goedgekeurdeGebruikers ?? []) {
    naamMap[u.user_id] = [u.voornaam, u.achternaam].filter(Boolean).join(' ')
    goedgekeurdeIds.add(u.user_id)
  }

  const sessies = alleSessies.filter(s => s.user_id && goedgekeurdeIds.has(s.user_id)).slice(0, cap)

  if (!sessies.length) {
    return NextResponse.json({ zelfbeoordeling: null, expertpanel: null, count: 0, id: null })
  }

  // Arno's eigen input ophalen (max 45 dagen oud). arnobot_meta_input is een
  // sleutel/waarde-tabel (key, value, updated_at), niet een log met een rij per opslag.
  const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
  const { data: arnoInput } = await supabase
    .from('arnobot_meta_input')
    .select('value, updated_at')
    .eq('key', 'panel_input')
    .gte('updated_at', cutoff)
    .maybeSingle()
  const arnoInputTekst = arnoInput?.value ?? null

  const vorigeAnalyse = await fetchVorigeAnalyse(supabase)

  const sessionIds = sessies.map(s => s.session_id).filter(Boolean) as string[]

  // Stap 2: haal gesprekken op uit rds_logs
  let logsQuery = supabase
    .from('arnobot_rds_logs')
    .select('session_id, question, answer, created_at')
    .in('session_id', sessionIds)
    .order('created_at', { ascending: true })

  if (ownerUserId) logsQuery = logsQuery.neq('user_id', ownerUserId)
  const [{ data: logs }, { data: ratingsData }] = await Promise.all([
    logsQuery,
    supabase
      .from('arnobot_rds_logs')
      .select('question, answer, feedback')
      .in('session_id', sessionIds)
      .not('feedback', 'is', null),
  ])

  const allRatings = ratingsData ?? []
  const totalRatings = allRatings.length
  const positiveRatings = allRatings.filter((r: { feedback: string }) => r.feedback === 'pos').length
  const negativeExamples = allRatings
    .filter((r: { feedback: string }) => r.feedback === 'neg')
    .slice(0, 5)
    .map((r: { question: string; answer: string }) =>
      `Vraag: "${r.question.slice(0, 80)}"\nAntwoord (begin): "${r.answer.slice(0, 150)}..."`)
    .join('\n\n')

  const gebruikersJurorSection = totalRatings > 0
    ? `\n\nGEBRUIKERS\n(Collectief oordeel op basis van ${totalRatings} antwoordbeoordelingen. Gebruikers beoordeelden ArnoBot-antwoorden met een duimpje omhoog of omlaag.)\nScore: ${(positiveRatings / totalRatings * 10).toFixed(1)}/10 (${Math.round(positiveRatings / totalRatings * 100)}% positief, ${totalRatings} beoordelingen)\n[Analyseer de negatief beoordeelde antwoorden op patronen. Wat triggert negatieve reacties: toon, relevantie, lengte, type vraag? Schrijf vanuit het perspectief van de gebruikers als collectief.${negativeExamples ? `\n\nNegatief beoordeeld:\n${negativeExamples}` : ''}]\nKritisch punt: [één concrete aanbeveling op basis van de gebruikersbeoordelingen]`
    : `\n\nGEBRUIKERS\n(Nog geen antwoordbeoordelingen ontvangen in deze analyseperiode.)\nScore: n.v.t.\n[Geen gebruikersdata beschikbaar. Vermeld dat de rating-functionaliteit actief is en dat scores zichtbaar worden zodra gebruikers antwoorden beoordelen.]\nKritisch punt: n.v.t.`

  // Stap 3: groepeer per sessie, max 5 exchanges per sessie
  const bySession: Record<string, { question: string; answer: string }[]> = {}
  for (const log of logs ?? []) {
    if (!bySession[log.session_id]) bySession[log.session_id] = []
    if (bySession[log.session_id].length < 5) {
      bySession[log.session_id].push({ question: log.question, answer: log.answer })
    }
  }

  // Stap 4: bouw transcripts — alleen sessies mét echte gesprekken
  const rijkeSessies = sessies.filter(s => (bySession[s.session_id]?.length ?? 0) > 0)

  if (!rijkeSessies.length) {
    return NextResponse.json({ zelfbeoordeling: null, expertpanel: null, count: 0, id: null })
  }

  const transcripts = rijkeSessies
    .map((s, i) => {
      const naam = naamMap[s.user_id] || 'Onbekend'
      const exchanges = bySession[s.session_id]
        .map(e => `GEBRUIKER: ${e.question}\n\nARNO: ${e.answer}`)
        .join('\n\n---\n\n')
      return `GESPREK ${i + 1} (${naam}${s.title ? ` · ${s.title}` : ''}):\n\n${exchanges}`
    })
    .join('\n\n====\n\n')

  const sessieCount = rijkeSessies.length
  const periodeLabel = days === 7 ? 'afgelopen week' : days === 30 ? 'afgelopen maand' : days === 90 ? 'afgelopen kwartaal' : `afgelopen ${days} dagen`

  // Stap 5: zelfbeoordeling en expertpanel parallel
  const callZelfModel = (maxTokens = ZELF_MAX_TOKENS) => anthropic.messages.create({
    model: 'claude-fable-5',
    max_tokens: maxTokens,
    system: `Je analyseert gesprekken van ArnoBot als kritische zelfreflectie. Je schrijft vanuit het perspectief van ArnoBot zelf: wat deed ik goed, waar schoot ik tekort, wat mis ik in mijn kennisbasis? Wees eerlijk en specifiek. Geen ijdelheid. Verwijs naar concrete gesprekken.

${ARNOBOT_MANDAAT}

Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`,
    messages: [{
      role: 'user',
      content: `Hieronder staan ${sessieCount} echte gesprekken van de ${periodeLabel}. Analyseer jezelf kritisch.\n\n${transcripts}${vorigZelfBlok(vorigeAnalyse)}\n\nGeef een zelfbeoordeling in vier blokken. Begin elk blok met de naam in hoofdletters op een aparte regel:\n\nWAAR IK STERK WAS\n[concreet, met verwijzing naar de gesprekken. Minimaal 3 observaties.]\n\nWAAR IK TEKORT SCHOOT\n[eerlijk, specifiek. Geen algemeenheden. Minimaal 3 observaties.]\n\nKENNISHIATEN\n[welke vragen kwamen op terrein waar je onvoldoende diepgang had? Wees specifiek.]\n\nWAT IK ZOU VERBETEREN\n[concrete aanbevelingen voor de systeemprompt of kennisbasis. Minimaal 3 punten.]${vorigeAnalyse ? TREND_ZELF_INSTRUCTIE : ''}`,
    }],
  })
  const callPanelModel = (maxTokens = PANEL_MAX_TOKENS) => anthropic.messages.create({
    model: 'claude-fable-5',
    max_tokens: maxTokens,
    system: `Je coördineert een expertpanel van zes figuren die ArnoBot beoordelen als salescoach. Elk jurylid spreekt in de ik-vorm, vanuit zijn eigen filosofie en vocabulaire. Wees kritisch en specifiek. Verwijs naar de daadwerkelijke gesprekken. Geen vage complimenten.

${ARNOBOT_MANDAAT}

Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`,
    messages: [{
      role: 'user',
      content: `Hieronder staan ${sessieCount} echte gesprekken van ArnoBot de ${periodeLabel}. Laat elk jurylid een oordeel geven in hun eigen stem.\n\n${transcripts}${vorigPanelBlok(vorigeAnalyse)}\n\nGeef het oordeel van elk jurylid. Begin elke sectie met de naam in hoofdletters:\n\nMARSHALL GOLDSMITH\n(Executive Coach #1 ter wereld, auteur van "What Got You Here Won\'t Get You There". Zijn centrale overtuiging: echte coaching verandert specifiek gedrag, niet alleen inzicht. Accountability is alles.)\nScore: [X]/10\n[Concreet oordeel in 3-4 zinnen. Verwijs naar specifieke gesprekken. Was er een specifiek gedrag geïdentificeerd? Werd de vraag achter de vraag aangepakt?]\nKritisch punt: [één concrete aanbeveling]\n\nTONY ROBBINS\n(Life & Business Strategist, 50 miljoen mensen bereikt. Zijn centrale vraag: verliet de gebruiker dit gesprek sterker dan hij erin ging? Werd er een grotere visie gecreëerd?)\nScore: [X]/10\n[Concreet oordeel. Werden threats omgezet in opportunities? Is er peak state gecreëerd of bleef het intellectueel?]\nKritisch punt: [één concrete aanbeveling]\n\nELON MUSK\n(CEO Tesla, SpaceX, X. First principles denken. Geen geduld voor vaagheid. De meest directe weg naar resultaat.)\nScore: [X]/10\n[Concreet oordeel. Was het actiegericht? Werd de kern bereikt of bleef ArnoBot ronddraaien?]\nKritisch punt: [één concrete aanbeveling]\n\nDANIEL KAHNEMAN\n(Nobelprijswinnaar Psychologie, "Thinking, Fast and Slow". Menselijk gedrag wordt grotendeels gestuurd door System 1, niet System 2. De meeste coaching faalt omdat ze alleen System 2 aanspreekt.)\nScore: [X]/10\n[Concreet oordeel. Werden emotionele drijfveren aangesproken of bleef het rationeel advies?]\nKritisch punt: [één concrete aanbeveling]\n\nJORDAN BELFORT\n(Wolf of Wall Street, salestrainer. Zijn lens: was het advies commercieel scherp genoeg? Sluit de gebruiker na dit gesprek meer deals?)\nScore: [X]/10\n[Concreet oordeel. Waren de adviezen veldklaar en bruikbaar? Of te filosofisch?]\nKritisch punt: [één concrete aanbeveling]${arnoInputTekst
  ? `\n\nARNO DIEPEVEEN\n(Oprichter Royal Dutch Sales. Arno heeft deze maand zijn eigen observaties aangeleverd. Verwerk zijn input als een juryoordeel: zijn woorden staan er letterlijk in, jij voegt structuur en score toe.)\nArno\'s eigen aantekeningen: "${arnoInputTekst}"\nScore: [X]/10\n[Verwerk Arno\'s observaties in een concreet oordeel op de gesprekken. Wat herkent hij? Wat bevestigt of weerspreekt de gesprekken zijn punt?]\nKritisch punt: [één concrete aanbeveling die voortbouwt op zijn aantekeningen]`
  : `\n\nARNO DIEPEVEEN\n(Oprichter Royal Dutch Sales. Geen eigen input deze maand. Beoordeel op basis van de gesprekken: herkent de echte Arno zichzelf hierin? Is dit zijn stem, zijn directheid, zijn timing van confronteren?)\nScore: [X]/10\n[Concreet oordeel op toon, aanpak en authenticiteit van de stem]\nKritisch punt: [één concrete aanbeveling om ArnoBot dichter bij de echte Arno te brengen]`
}${gebruikersJurorSection}${vorigeAnalyse ? TREND_PANEL_INSTRUCTIE : ''}\n\nOVERALL SCORE: [gemiddelde van zeven scores, of zes als gebruikers n.v.t. is]/10\nPANEL CONSENSUS: [één zin die de kern van het gezamenlijke oordeel samenvat]\nPRIORITEIT 1: [het meest impactvolle verbeterpunt waarover het panel het eens is]`,
    }],
  })
  const callJouwAnalyseModel = (maxTokens = JOUW_ANALYSE_MAX_TOKENS) => anthropic.messages.create({
    model: 'claude-fable-5',
    max_tokens: maxTokens,
    system: `Je verwerkt Arno's eigen geschreven analyse van ArnoBot tot een gestructureerd overzicht. Dit zijn zijn eigen observaties, geen reactie op een steekproef gesprekken. Jouw taak is puur ordenen en concreet maken, niet samenvatten of comprimeren. Elk afzonderlijk punt dat hij noemt krijgt een eigen blok, hoeveel dat er ook zijn. Verzin niets en voeg geen onderwerpen toe die hij niet noemde.

${ARNOBOT_MANDAAT}

Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst.
Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`,
    messages: [{
      role: 'user',
      content: `Dit zijn Arno's eigen aantekeningen over ArnoBot:\n\n"${arnoInputTekst}"\n\nSplits dit op in losse, afzonderlijke punten, zoveel als hij daadwerkelijk noemt, geen vast aantal. Voor elk punt exact dit format:\n\nPUNT [n]: [korte titel, max 6 woorden]\n[zijn observatie, opgeschoond tot een heldere alinea, niet ingekort tot één zin als hij meer schreef]\nKritisch punt: [concrete, direct implementeerbare aanbeveling in de stijl "doe X wanneer Y"]\n\nBehandel elk punt apart, laat niets weg. Voeg twee opmerkingen alleen samen als ze overduidelijk hetzelfde onderwerp raken.`,
    }],
  })

  const jouwAnalysePromise = arnoInputTekst ? callJouwAnalyseModel() : null

  const [zelfResponse, panelResponse] = await Promise.all([callZelfModel(), callPanelModel()])

  let zelfbeoordeling = extractText(zelfResponse, 'zelfbeoordeling')
  let expertpanel = extractText(panelResponse, 'expertpanel')

  if (!zelfbeoordeling) {
    console.error('[admin/meta-analyse] lege/refusal zelfbeoordeling, retry')
    zelfbeoordeling = extractText(await callZelfModel(), 'zelfbeoordeling retry')
  } else if (zelfResponse.stop_reason === 'max_tokens') {
    console.error('[admin/meta-analyse] zelfbeoordeling afgekapt op max_tokens, retry met meer ruimte')
    const retryText = extractText(await callZelfModel(ZELF_MAX_TOKENS * 2), 'zelfbeoordeling retry (meer ruimte)')
    if (retryText) zelfbeoordeling = retryText
  }
  if (!expertpanel) {
    console.error('[admin/meta-analyse] leeg/refusal expertpanel, retry')
    expertpanel = extractText(await callPanelModel(), 'expertpanel retry')
  } else if (panelResponse.stop_reason === 'max_tokens') {
    console.error('[admin/meta-analyse] expertpanel afgekapt op max_tokens, retry met meer ruimte')
    const retryText = extractText(await callPanelModel(PANEL_MAX_TOKENS * 2), 'expertpanel retry (meer ruimte)')
    if (retryText) expertpanel = retryText
  }
  if (!zelfbeoordeling || !expertpanel) {
    console.error('[admin/meta-analyse] analyse na retry nog steeds (deels) leeg')
    return NextResponse.json({ error: 'genereren_mislukt' }, { status: 500 })
  }

  let jouwAnalyse: string | null = null
  if (jouwAnalysePromise) {
    const jouwResponse = await jouwAnalysePromise
    jouwAnalyse = extractText(jouwResponse, 'jouw-analyse')
    if (!jouwAnalyse) {
      console.error('[admin/meta-analyse] lege/refusal jouw-analyse, retry')
      jouwAnalyse = extractText(await callJouwAnalyseModel(), 'jouw-analyse retry')
    } else if (jouwResponse.stop_reason === 'max_tokens') {
      console.error('[admin/meta-analyse] jouw-analyse afgekapt op max_tokens, retry met meer ruimte')
      const retryText = extractText(await callJouwAnalyseModel(JOUW_ANALYSE_MAX_TOKENS * 2), 'jouw-analyse retry (meer ruimte)')
      if (retryText) jouwAnalyse = retryText
    }
    if (!jouwAnalyse) {
      console.error('[admin/meta-analyse] jouw-analyse na retry nog steeds leeg, sectie overgeslagen')
    }
  }

  const { data: saved } = await supabase
    .from('arnobot_meta_analyses')
    .insert({ period_days: days, session_count: sessieCount, zelfbeoordeling_text: zelfbeoordeling, expertpanel_text: expertpanel, jouw_analyse_text: jouwAnalyse })
    .select('id')
    .single()

  return NextResponse.json({
    zelfbeoordeling,
    expertpanel,
    jouwAnalyse,
    jouwAnalyseFailed: !!(arnoInputTekst && !jouwAnalyse),
    count: sessieCount,
    id: saved?.id ?? null,
  })
}
