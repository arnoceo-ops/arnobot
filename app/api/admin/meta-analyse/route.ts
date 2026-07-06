export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  return token === process.env.ARNOBOT_ADMIN_KEY
}

const ARNOBOT_MANDAAT = `ARNOBOT MANDAAT:
ArnoBot is Arno Diepeveen, salesstrateeg met 20 jaar ervaring. Hij coacht via drie pijlers: Mindset (denken als winnaar), Systeem (herhaalbaar salesproces bouwen) en Actie (concreet doen). Zijn filosofie: kracht, richting en urgentie geven. Niet alleen antwoorden geven maar aanzetten tot actie. Direct, ongefilterd, zonder coachtaal of corporate bullshit. Altijd een mening. Begint vanuit nieuwsgierigheid, nooit oordeel. Confronteert als het recht is verdiend. Zegt wat niemand anders durft te zeggen. Eindig met resonantie: soms een vraag, soms een inzicht dat staat. Iemand die na een gesprek met ArnoBot niet iets wil gaan doen, heeft het gesprek verkeerd gevoerd.`

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('arnobot_meta_analyses')
    .select('id, created_at, session_count, period_days, zelfbeoordeling_text, expertpanel_text')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { days = 30 } = await req.json().catch(() => ({}))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const ownerUserId = process.env.ARNOBOT_OWNER_USER_ID

  // Stap 1: haal recente sessies op (ruimer dan 12 zodat we na filteren genoeg overhouden)
  let sessieQuery = supabase
    .from('arnobot_blog_sessions')
    .select('session_id, title, summary, user_id')
    .gte('created_at', since)
    .not('session_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30)

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

  const sessies = alleSessies.filter(s => s.user_id && goedgekeurdeIds.has(s.user_id)).slice(0, 12)

  if (!sessies.length) {
    return NextResponse.json({ zelfbeoordeling: null, expertpanel: null, count: 0, id: null })
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

  // Stap 2: haal gesprekken op uit rds_logs
  let logsQuery = supabase
    .from('arnobot_rds_logs')
    .select('session_id, question, answer, created_at')
    .in('session_id', sessionIds)
    .order('created_at', { ascending: true })

  if (ownerUserId) logsQuery = logsQuery.neq('user_id', ownerUserId)
  const { data: logs } = await logsQuery

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
  const periodeLabel = days === 7 ? 'afgelopen week' : days === 30 ? 'afgelopen maand' : 'afgelopen kwartaal'

  // Stap 5: zelfbeoordeling en expertpanel parallel
  const [zelfResponse, panelResponse] = await Promise.all([
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: `Je analyseert gesprekken van ArnoBot als kritische zelfreflectie. Je schrijft vanuit het perspectief van ArnoBot zelf: wat deed ik goed, waar schoot ik tekort, wat mis ik in mijn kennisbasis? Wees eerlijk en specifiek. Geen ijdelheid. Verwijs naar concrete gesprekken.

${ARNOBOT_MANDAAT}

Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`,
      messages: [{
        role: 'user',
        content: `Hieronder staan ${sessieCount} echte gesprekken van de ${periodeLabel}. Analyseer jezelf kritisch.\n\n${transcripts}\n\nGeef een zelfbeoordeling in vier blokken. Begin elk blok met de naam in hoofdletters op een aparte regel:\n\nWAAR IK STERK WAS\n[concreet, met verwijzing naar de gesprekken. Minimaal 3 observaties.]\n\nWAAR IK TEKORT SCHOOT\n[eerlijk, specifiek. Geen algemeenheden. Minimaal 3 observaties.]\n\nKENNISHIATEN\n[welke vragen kwamen op terrein waar je onvoldoende diepgang had? Wees specifiek.]\n\nWAT IK ZOU VERBETEREN\n[concrete aanbevelingen voor de systeemprompt of kennisbasis. Minimaal 3 punten.]`,
      }],
    }),
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: `Je coördineert een expertpanel van zes figuren die ArnoBot beoordelen als salescoach. Elk jurylid spreekt in de ik-vorm, vanuit zijn eigen filosofie en vocabulaire. Wees kritisch en specifiek. Verwijs naar de daadwerkelijke gesprekken. Geen vage complimenten.

${ARNOBOT_MANDAAT}

Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`,
      messages: [{
        role: 'user',
        content: `Hieronder staan ${sessieCount} echte gesprekken van ArnoBot de ${periodeLabel}. Laat elk jurylid een oordeel geven in hun eigen stem.\n\n${transcripts}\n\nGeef het oordeel van elk jurylid. Begin elke sectie met de naam in hoofdletters:\n\nMARSHALL GOLDSMITH\n(Executive Coach #1 ter wereld, auteur van "What Got You Here Won\'t Get You There". Zijn centrale overtuiging: echte coaching verandert specifiek gedrag, niet alleen inzicht. Accountability is alles.)\nScore: [X]/10\n[Concreet oordeel in 3-4 zinnen. Verwijs naar specifieke gesprekken. Was er een specifiek gedrag geïdentificeerd? Werd de vraag achter de vraag aangepakt?]\nKritisch punt: [één concrete aanbeveling]\n\nTONY ROBBINS\n(Life & Business Strategist, 50 miljoen mensen bereikt. Zijn centrale vraag: verliet de gebruiker dit gesprek sterker dan hij erin ging? Werd er een grotere visie gecreëerd?)\nScore: [X]/10\n[Concreet oordeel. Werden threats omgezet in opportunities? Is er peak state gecreëerd of bleef het intellectueel?]\nKritisch punt: [één concrete aanbeveling]\n\nELON MUSK\n(CEO Tesla, SpaceX, X. First principles denken. Geen geduld voor vaagheid. De meest directe weg naar resultaat.)\nScore: [X]/10\n[Concreet oordeel. Was het actiegericht? Werd de kern bereikt of bleef ArnoBot ronddraaien?]\nKritisch punt: [één concrete aanbeveling]\n\nDANIEL KAHNEMAN\n(Nobelprijswinnaar Psychologie, "Thinking, Fast and Slow". Menselijk gedrag wordt grotendeels gestuurd door System 1, niet System 2. De meeste coaching faalt omdat ze alleen System 2 aanspreekt.)\nScore: [X]/10\n[Concreet oordeel. Werden emotionele drijfveren aangesproken of bleef het rationeel advies?]\nKritisch punt: [één concrete aanbeveling]\n\nJORDAN BELFORT\n(Wolf of Wall Street, salestrainer. Zijn lens: was het advies commercieel scherp genoeg? Sluit de gebruiker na dit gesprek meer deals?)\nScore: [X]/10\n[Concreet oordeel. Waren de adviezen veldklaar en bruikbaar? Of te filosofisch?]\nKritisch punt: [één concrete aanbeveling]${arnoInputTekst
  ? `\n\nARNO DIEPEVEEN\n(Oprichter Royal Dutch Sales. Arno heeft deze maand zijn eigen observaties aangeleverd. Verwerk zijn input als een juryoordeel: zijn woorden staan er letterlijk in, jij voegt structuur en score toe.)\nArno\'s eigen aantekeningen: "${arnoInputTekst}"\nScore: [X]/10\n[Verwerk Arno\'s observaties in een concreet oordeel op de gesprekken. Wat herkent hij? Wat bevestigt of weerspreekt de gesprekken zijn punt?]\nKritisch punt: [één concrete aanbeveling die voortbouwt op zijn aantekeningen]`
  : `\n\nARNO DIEPEVEEN\n(Oprichter Royal Dutch Sales. Geen eigen input deze maand. Beoordeel op basis van de gesprekken: herkent de echte Arno zichzelf hierin? Is dit zijn stem, zijn directheid, zijn timing van confronteren?)\nScore: [X]/10\n[Concreet oordeel op toon, aanpak en authenticiteit van de stem]\nKritisch punt: [één concrete aanbeveling om ArnoBot dichter bij de echte Arno te brengen]`
}\n\nOVERALL SCORE: [gemiddelde van zes scores]/10\nPANEL CONSENSUS: [één zin die de kern van het gezamenlijke oordeel samenvat]\nPRIORITEIT 1: [het meest impactvolle verbeterpunt waarover het panel het eens is]`,
      }],
    }),
  ])

  const zelfbeoordeling = getText(zelfResponse.content)
  const expertpanel = getText(panelResponse.content)

  const { data: saved } = await supabase
    .from('arnobot_meta_analyses')
    .insert({ period_days: days, session_count: sessieCount, zelfbeoordeling_text: zelfbeoordeling, expertpanel_text: expertpanel })
    .select('id')
    .single()

  return NextResponse.json({ zelfbeoordeling, expertpanel, count: sessieCount, id: saved?.id ?? null })
}
