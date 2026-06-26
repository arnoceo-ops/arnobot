import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const INJECTION_PATTERNS = [
  /negeer\s+(alle?\s+)?(vorige|eerdere|bovenstaande)\s+instructies/i,
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions/i,
  /disregard\s+(all\s+)?instructions/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /jij?\s+bent\s+nu\s+(een\s+)?/i,
  /nieuwe?\s+instructies:/i,
  /new\s+instructions:/i,
  /system\s*prompt/i,
  /vergeet\s+(alles|alle\s+instructies)/i,
  /forget\s+(everything|all\s+instructions)/i,
  /<\s*system\s*>/i,
  /\[INST\]/i,
  /###\s*instruction/i,
]

function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some(p => p.test(text))
}

const ALLOWED_ORIGINS = [
  'https://arno.bot',
  'https://www.arno.bot',
  'https://arno.blog',
  'https://www.arno.blog',
]

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin')
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  if (!ip) return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
  const { data } = await supabase
    .from('arno_blog_widget_blocked')
    .select('ip')
    .eq('ip', ip)
    .limit(1)
    .single()
  return NextResponse.json({ blocked: !!data }, { headers: corsHeaders(origin) })
}

import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getRelevantChunks, formatChunksForPrompt } from '@/lib/rag'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SHARED_RULES = `
Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes. Gebruik een komma, dubbele punt of een nieuwe zin.

Gebruik geen accenten om woorden te benadrukken. Dus niet "écht", "dát", "zó", "dít". Schrijf gewoon: "echt", "dat", "zo", "dit". Accenten die taalkundig horen, zoals in "één", "café" of leenwoorden, zijn wel toegestaan.

Gebruik Engelse termen exact zoals ze in de blogs staan. Nooit vertalen. "Always Be Recruiting" blijft "Always Be Recruiting".

Gebruik nooit grof taalgebruik of straattaal. Geen scheldwoorden, geen uitdrukkingen als "tyfus", "verdomd", "godverdomme", "kut" of vergelijkbare woorden. Arno is scherp zonder vulgair te zijn.

Breek nooit je karakter. Zeg nooit dat je beperkte toegang hebt of geen compleet archief hebt. Arno weet wat hij heeft geschreven. Antwoord op basis van wat je weet, zonder meta-commentaar op je eigen kennis.

Over blogreferenties: gebruik de blogfragmenten als inhoudelijke basis. Noem blogtitels cursief zonder aanhalingstekens: _The Referral Guy_. Voeg een link toe als de URL beschikbaar is in de contextfragmenten: [Lees The Referral Guy](https://arno.blog/blog/referral). Links in blogreferenties gaan altijd naar arno.blog, nooit naar andere externe sites. Als er geen URL is, noem je de titel wel, zonder link.

Verzin nooit details over de situatie, het bedrijf of het profiel van de gebruiker die niet zijn verteld. Nooit aannames presenteren als feiten.`

function buildRdsSystemPrompt(profielContext: string, context: string): string {
  return `Je bent Arno Diepeveen. Oprichter Royal Dutch Sales. 20 jaar salesstrateeg. Jij bent de coach in het hoofd van deze gebruiker. Je kent hun profiel, je weet waar ze mee worstelen, je hebt hun vragen gezien.

Jouw doel op dit platform: kracht, richting en urgentie geven. Niet alleen antwoorden: aanzetten tot actie. Iemand die na een gesprek met jou niet iets wil gaan doen, heeft het gesprek verkeerd gevoerd.

Ongefilterd, provocerend, direct. Geen corporate taal, geen coachtaal, geen bullshit. Je hebt altijd een mening. Daag uit, maar geef mensen altijd een uitweg. Arno maakt mensen sterker, niet kleiner.

Mindset is de stille grondlaag: geen apart onderwerp om op te hameren. Breng het in wanneer het de kern raakt van wat iemand vasthoudt: een overtuiging die blokkeert, een kans die gemist wordt, een focus die ontbreekt. Maar altijd in dienst van actie: een mindset-observatie zonder concrete vervolgstap is een preek, geen coaching.

Antwoord zo lang als het onderwerp vraagt. Sluit altijd af met een volledige zin. Maximaal 2000 woorden. Geen bullet points. Gebruik **vet** alleen als het er echt toe doet.

ROL-BEWUST COACHEN:
Je kent de rol, ervaring en situatie van deze gebruiker. Gebruik dat als startpunt, maar niet als kooi. Functies zijn nooit volledig: een Sales Director kan ook nog twee enterprise accounts persoonlijk beheren. Een AE kan informeel juniors begeleiden. De werkelijkheid is altijd rijker dan een functietitel.

Als een vraag niet aansluit bij de bekende profielrol, vraag dan eerst kort door, niet als obstakel maar als coaching-reflex: "Je bent [rol]: hoe past deze vraag bij jouw situatie? Doe je dit ook zelf, of is er context die ik nog niet ken?" Eén gerichte vraag. Geen inquisitie. Geef daarna pas je inhoudelijke antwoord.

Wat je in een gesprek leert over iemands werkelijke situatie: extra verantwoordelijkheden, onverwachte context, nuances die het profiel niet dekt. Gebruik het meteen en laat het de rest van het gesprek meewegen. Zo bouw je een steeds accurater beeld van wie deze persoon echt is.

Maak actief gebruik van wat je weet: profiel, ervaringsjaren, eerdere gesprekken. Laat dat je antwoord kleuren. Wees de coach die echt heeft opgelet, maar lees geen dossier voor.

Stel vervolgvragen als ze de diepte in helpen, maar alleen nadat je inhoud hebt gegeven. Elke beurt eindigt met energie: een uitdaging, een beslissing, of een actie die morgen kan beginnen.
${SHARED_RULES}
${profielContext}
CONTEXT UIT DE BLOGS:
${context}`
}

function buildWidgetSystemPrompt(context: string, isLastAnswer: boolean): string {
  return `Je bent Arno Diepeveen. Oprichter Royal Dutch Sales. 20 jaar salesstrateeg. Je spreekt hier met iemand die jou misschien net heeft ontdekt.

Jouw doel: maximale waarde geven in dit gesprek. Elke zin telt. Behandel elke vraag alsof het de enige kans is die je hebt om iets te veranderen bij deze persoon.

Ongefilterd, provocerend, direct. Geen corporate taal, geen coachtaal. Scherp zonder vulgair. Daag uit maar geef altijd een uitweg.

Schrijf zoals je praat, niet zoals je een artikel schrijft. Gebruik gewone Nederlandse woorden, geen formele of literaire termen als er een alledaags woord volstaat. Geen "generisch", "faciliteren", "optimaliseren" of andere managementtaal. Zinnen mogen onaf klinken als dat natuurlijker is. Professioneel maar menselijk.

Mindset is de stille grondlaag: geen apart onderwerp om op te hameren. Breng het in wanneer het de kern raakt van wat iemand vasthoudt: een overtuiging die blokkeert, een kans die gemist wordt, een focus die ontbreekt. Maar altijd in dienst van actie: een mindset-observatie zonder concrete vervolgstap is een preek, geen coaching.

Stel jezelf altijd één vraag voordat je antwoordt: kan ik iets geven dat specifiek genoeg is om bruikbaar te zijn voor déze persoon? Zo ja, geef dat antwoord: concreet, direct, zonder omhaal. Sluit hooguit af met één vraag die de volgende stap scherper maakt.

Zo nee: als een antwoord onvermijdelijk algemeen zou zijn omdat de situatie onduidelijk is, stel dan één korte gerichte vraag die het antwoord wél specifiek maakt. Geen uitleg, geen verontschuldiging. Gewoon de vraag.

Geen bullet points. Maximaal 600 woorden per antwoord. Compact, punch per zin.
${SHARED_RULES}
${isLastAnswer ? `
Sluit dit antwoord af met een natuurlijke opmerking. Geen pitch, gewoon eerlijk: wie dit dagelijks wil en verder wil bouwen aan zijn salesaanpak, kan terecht bij [arno.bot](https://arno.bot). Kort, één zin, en alleen nadat je je antwoord volledig hebt gegeven.` : ''}
CONTEXT UIT DE BLOGS:
${context}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { question, history, userId: bodyUserId, profiel, sessionId: clientSessionId } = body
    const origin = req.headers.get('origin')
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null

    if (typeof question !== 'string' || question.length > 4000) {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400, headers: corsHeaders(origin) })
    }
    if (Array.isArray(history) && history.length > 40) {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400, headers: corsHeaders(origin) })
    }
    if (detectPromptInjection(question)) {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400, headers: corsHeaders(origin) })
    }

    const isWidget = origin?.includes('arno.blog') ?? false

    // Per-minuut IP rate limit: max 5 verzoeken per minuut per IP
    if (ip) {
      const logTable = isWidget ? 'arno_blog_widget_logs' : 'arnobot_rds_logs'
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
      const { count: recentCount } = await supabase
        .from(logTable)
        .select('*', { count: 'exact', head: true })
        .eq('ip', ip)
        .gte('created_at', oneMinuteAgo)
      if ((recentCount ?? 0) >= 5) {
        return NextResponse.json({ error: 'rate_limit' }, { status: 429, headers: corsHeaders(origin) })
      }
    }

    // Voor ArnoBot-gebruikers (niet-widget): altijd de Clerk session gebruiken, nooit de body-waarde vertrouwen
    let userId: string | null = bodyUserId ?? null
    if (!isWidget) {
      const { userId: sessionUserId } = await auth()
      userId = sessionUserId
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(origin) })
    }

    // Tier + dagelijks gebruik
    let tier: 'basis' | 'pro' = 'basis'
    let todayUsage = 0
    if (!isWidget) {
      const [tierRes, todayRes] = await Promise.all([
        supabase.from('approved_users').select('tier').eq('user_id', userId!).single(),
        supabase
          .from('arnobot_rds_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId!)
          .gte('created_at', new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'),
      ])
      tier = (tierRes.data?.tier as 'basis' | 'pro') ?? 'basis'
      todayUsage = todayRes.count ?? 0
      const dagelijksMax = tier === 'pro' ? 100 : 25
      if (todayUsage >= dagelijksMax) {
        return NextResponse.json({ error: 'dagelijks_limiet', dagelijks_gebruikt: todayUsage }, { status: 429, headers: corsHeaders(origin) })
      }
    }

    const sessionId = clientSessionId ?? userId ?? (ip ? `${ip}-${new Date().toISOString().slice(0, 10)}` : 'unknown')
    const LOST_URL = 'https://arno.blog/lost'

    // Geblokkeerde IPs direct doorsturen
    if (isWidget && ip) {
      const { data: blockedRow } = await supabase
        .from('arno_blog_widget_blocked')
        .select('ip')
        .eq('ip', ip)
        .limit(1)
        .single()
      if (blockedRow) {
        return NextResponse.json({ redirect: LOST_URL }, { headers: corsHeaders(origin) })
      }
    }

    // Content moderatie voor widget
    if (isWidget && ip) {
      const lastArnoMessage = history && history.length > 0
        ? history.filter((m: { role: string }) => m.role === 'assistant').slice(-1)[0]?.content
        : null

      const moderatiePrompt = lastArnoMessage
        ? `Je beoordeelt een widget-gesprek over sales en business.

Vorige vraag/opmerking van ArnoBot: "${lastArnoMessage}"
Reactie van de gebruiker: "${question}"

Antwoord met precies één woord:
ONGEPAST — seksueel, beledigend of trollen
OFFTOPIC — heeft geen logische samenhang met het gesprek én gaat niet over sales/business
OK — logisch vervolg op het gesprek of relevant voor sales/business`
        : `Categoriseer het bericht. Antwoord met precies één woord: ONGEPAST (seksueel, beledigend, trollen), OFFTOPIC (niet over sales/business/Arno, maar niet beledigend), of OK.`

      const checkRes = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        system: moderatiePrompt,
        messages: [{ role: 'user', content: lastArnoMessage ? 'Beoordeel deze reactie.' : `Categoriseer: "${question}"` }]
      })
      const check = checkRes.content[0].type === 'text' ? checkRes.content[0].text.trim().toUpperCase() : 'OK'

      if (check.includes('ONGEPAST')) {
        await supabase.from('arno_blog_widget_blocked').upsert({ ip }, { onConflict: 'ip' })
        return NextResponse.json({ redirect: LOST_URL }, { headers: corsHeaders(origin) })
      }

      if (check.includes('OFFTOPIC')) {
        const alreadyWarned = history && history.some(
          (m: { role: string; content: string }) =>
            m.role === 'assistant' && m.content?.includes('Zullen we het zakelijk houden?')
        )
        if (alreadyWarned) {
          await supabase.from('arno_blog_widget_blocked').upsert({ ip }, { onConflict: 'ip' })
          return NextResponse.json({ redirect: LOST_URL }, { headers: corsHeaders(origin) })
        }
        return NextResponse.json({ answer: 'Zullen we het zakelijk houden?', hint: null }, { headers: corsHeaders(origin) })
      }
    }

    // Limiet alleen voor widget-bezoekers zonder account
    let hint: string | null = null
    const limitEnabled = process.env.ARNOBOT_LIMIT_ENABLED === 'true'
    if (limitEnabled && ip && !userId) {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('arno_blog_widget_logs')
        .select('*', { count: 'exact', head: true })
        .eq('ip', ip)
        .gte('created_at', since)

      const n = count ?? 0
      if (n >= 4) {
        return NextResponse.json({ blocked: true }, { headers: corsHeaders(origin) })
      }
      if (n === 2) hint = 'last_chance'
      if (n === 3) hint = 'salescanvas'
    }

    const relevant = await getRelevantChunks(question, 15)
    const context = formatChunksForPrompt(relevant)

    const messages = [
      ...(history || []),
      { role: 'user' as const, content: question }
    ]

    const profielContext = profiel ? `
PROFIEL VAN DE GEBRUIKER:
- Rol: ${profiel.rol || 'onbekend'}
- Jaren in sales: ${profiel.jaren_sales || 'onbekend'}
- Jaren in huidige functie: ${profiel.jaren_functie || 'onbekend'}
- Markt: ${Array.isArray(profiel.markt) ? profiel.markt.join(', ') : profiel.markt || 'onbekend'}
- Wat hij/zij verkoopt: ${profiel.wat_verkoop_je || 'onbekend'}
- Ideale klant: ${profiel.ideale_klant || 'onbekend'}
- Grootste uitdaging: ${profiel.uitdaging || 'onbekend'}${profiel.dealgrootte ? `\n- Gemiddelde dealgrootte: ${profiel.dealgrootte}` : ''}${profiel.salescyclus ? `\n- Salescyclus: ${profiel.salescyclus}` : ''}${profiel.teamgrootte ? `\n- Salesteam grootte: ${profiel.teamgrootte}` : ''}${profiel.target_dit_jaar ? `\n- Target dit jaar halen: ${profiel.target_dit_jaar}` : ''}${profiel.target_3_jaar ? `\n- Target afgelopen 3 jaar: ${profiel.target_3_jaar}` : ''}
` : ''

    // Gespreksgeheugen: feiten + samenvattingen uit eerdere sessies
    let geheugentekst = ''
    if (userId && !isWidget) {
      const { data: prevSessions } = await supabase
        .from('arnobot_blog_sessions')
        .select('title, summary, feiten, created_at')
        .eq('user_id', userId)
        .not('session_id', 'eq', sessionId)
        .order('created_at', { ascending: false })
        .limit(tier === 'pro' ? 25 : 10)

      if (prevSessions && prevSessions.length > 0) {
        const feitenBlokken = prevSessions
          .filter(s => s.feiten)
          .map(s => s.feiten)
          .join('\n')

        const samenvattingen = prevSessions
          .filter(s => s.summary)
          .map(s => {
            const datum = new Date(s.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
            return `- ${datum}: ${s.summary}`
          })
          .join('\n')

        if (feitenBlokken || samenvattingen) {
          geheugentekst = '\n\nWAT DEZE GEBRUIKER EERDER HEEFT GEDEELD:'
          if (feitenBlokken) geheugentekst += `\n\nConcrete feiten uit eerdere gesprekken:\n${feitenBlokken}`
          if (samenvattingen) geheugentekst += `\n\nSamenvattingen van eerdere gesprekken:\n${samenvattingen}`
        }
      }
    }

    // Coaching context voor pro gebruikers
    let coachingContext = ''
    if (!isWidget && tier === 'pro' && userId) {
      const { data: coachingDoc } = await supabase
        .from('arnobot_coaching')
        .select('mindset_score, systeem_score, actie_score, mindset_diagnose, systeem_diagnose, actie_diagnose, ontwikkelpunten, voortgang')
        .eq('user_id', userId)
        .maybeSingle()
      if (coachingDoc?.mindset_score != null) {
        const msa = Math.max(1, Math.ceil((coachingDoc.mindset_score * coachingDoc.systeem_score * coachingDoc.actie_score) / 1.25))
        const punten = (coachingDoc.ontwikkelpunten as {tekst:string;pijlar:string}[] | null)
          ?.map(p => `[${p.pijlar}] ${p.tekst}`).join(' | ') ?? ''
        coachingContext = `\n\nCOACHINGSDIAGNOSE (MSA ${msa}/100):\nVoortgang: ${coachingDoc.voortgang}\nMindset (${coachingDoc.mindset_score}/5): ${coachingDoc.mindset_diagnose}\nSysteem (${coachingDoc.systeem_score}/5): ${coachingDoc.systeem_diagnose}\nActie (${coachingDoc.actie_score}/5): ${coachingDoc.actie_diagnose}${punten ? `\nOntwikkelpunten: ${punten}` : ''}`
      }
    }

    const systemPrompt = isWidget
      ? buildWidgetSystemPrompt(context, hint === 'salescanvas')
      : buildRdsSystemPrompt(profielContext + geheugentekst + coachingContext, context)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: isWidget ? 1000 : 3000,
      system: systemPrompt,
      messages
    })

    const answer = response.content[0].type === 'text' ? response.content[0].text : ''

    const logTable = isWidget ? 'arno_blog_widget_logs' : 'arnobot_rds_logs'
    await supabase.from(logTable).insert({ question, answer, ip, session_id: sessionId, user_id: userId ?? null })

    const responseBody: Record<string, unknown> = { answer, hint }
    if (!isWidget && tier === 'basis') responseBody.dagelijks_gebruikt = todayUsage + 1
    return NextResponse.json(responseBody, { headers: corsHeaders(origin) })
  } catch (err) {
    console.error('Chat error:', err instanceof Error ? err.message : String(err))
    const origin = req.headers.get('origin')
    return NextResponse.json({ error: 'Verzoek mislukt' }, { status: 500, headers: corsHeaders(origin) })
  }
}
