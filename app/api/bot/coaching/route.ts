export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { getRelevantChunks } from '@/lib/rag'
import { computeMsaScore } from '@/lib/msa'
import { RULE_ENGLISH_TERMS, RULE_NO_CRUDE_LANGUAGE, RULE_NEVER_BREAK_CHARACTER, RULE_NO_INVENTED_DETAILS } from '@/lib/systemPrompt'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function checkPremiumAccess(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('approved_users')
    .select('plan')
    .eq('user_id', userId)
    .single()
  return data?.plan !== 'basis'
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (!await checkPremiumAccess(userId)) return NextResponse.json({ error: 'Premium vereist' }, { status: 403 })

  const { data, error } = await supabase
    .from('arnobot_coaching')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) console.error('[coaching GET]', error.message)
  return NextResponse.json({ coaching: data ?? null })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (!await checkPremiumAccess(userId)) return NextResponse.json({ error: 'Premium vereist' }, { status: 403 })

  const [sessionsRes, sessionCountRes, analysesRes, profielRes, prevScoreRes, prevCoachingRes, actieStatRes, sparringRes] = await Promise.all([
    supabase
      .from('arnobot_blog_sessions')
      .select('session_id, title, summary, feiten, message_count, created_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
    // Los van de 50-limiet hierboven (die de AI-analyse behapbaar houdt): het werkelijke totaal
    // aantal gesprekken, voor tellingen die de gebruiker te zien krijgt (signalen, conversation_count).
    // sessions.length zou daarvoor nooit boven de 50 kunnen uitkomen, ook niet bij bijvoorbeeld 65.
    supabase
      .from('arnobot_blog_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null),
    supabase
      .from('arnobot_analyses')
      .select('id, analyse_text, created_at, session_count')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('arnobot_blog_profiles')
      .select('profiel')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('arnobot_coaching_scores')
      .select('mindset_score, systeem_score, actie_score, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('arnobot_coaching')
      .select('updated_at, used_session_ids, used_analyse_ids, mindset_score, mindset_diagnose, systeem_score, systeem_diagnose, actie_score, actie_diagnose, voortgang')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('arnobot_blog_sessions')
      .select('actie_status')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .not('actie_status', 'is', null)
      .not('actie_status', 'eq', 'skip')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('arnobot_sparring_sessions')
      .select('session_id, rol_categorie, persona, weerstand, debrief, message_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const sessions = sessionsRes.data ?? []
  const totalSessionCount = sessionCountRes.count ?? sessions.length
  const sparringSessions = (sparringRes.data ?? []).filter(s => s.debrief)
  if (totalSessionCount < 5) {
    return NextResponse.json({ error: 'te_weinig', count: totalSessionCount }, { status: 400 })
  }

  const analyses = analysesRes.data ?? []
  const prevCoaching = prevCoachingRes.data
  let weinig_voortgang = false
  let stagnatie = false

  if (prevCoaching) {
    const hoursSince = (Date.now() - new Date((prevCoaching as any).updated_at ?? 0).getTime()) / 3600000
    const allPrevHighScores =
      ((prevCoaching.mindset_score ?? 0) >= 4) &&
      ((prevCoaching.systeem_score ?? 0) >= 4) &&
      ((prevCoaching.actie_score ?? 0) >= 4)
    const prevWeinigVoortgang = (prevCoaching as any).weinig_voortgang === true

    const prevSessionIds = new Set<string>(prevCoaching.used_session_ids ?? [])
    const prevAnalyseIds = new Set<string>(prevCoaching.used_analyse_ids ?? [])
    const newSessions = sessions.filter(s => !prevSessionIds.has(s.session_id))
    const newAnalyses = analyses.filter(a => !prevAnalyseIds.has(a.id))
    const newSparring = sparringSessions.filter(s => new Date(s.created_at) > new Date((prevCoaching as any).updated_at ?? 0))
    const forceAllow = newSessions.length >= 3 && hoursSince >= 48

    const blockError = allPrevHighScores ? 'hoge_scores' : prevWeinigVoortgang ? 'stagnatie' : 'te_weinig_voortgang'

    if (newSessions.length > 0 || newAnalyses.length > 0 || newSparring.length > 0) {
      const newSessiesText = newSessions
        .map(s => `- ${s.title}${s.summary ? `: ${s.summary}` : ''}`)
        .join('\n')
      const newAnalysesText = newAnalyses
        .map(a => `- ${a.analyse_text.slice(0, 200)}`)
        .join('\n')
      const newSparringText = newSparring.length > 0 ? `\n\nNieuwe sparring-oefensessies: ${newSparring.length}` : ''

      let precheckText = 'nee'
      try {
        const precheck = await Sentry.startSpan({ name: 'coaching.precheck', op: 'ai.claude' }, () => anthropic.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 100,
          system: 'Je beoordeelt of nieuwe gesprekken kwalitatief andere patronen laten zien dan de vorige coaching. Antwoord uitsluitend met "ja" of "nee".',
          messages: [{
            role: 'user',
            content: `Vorige coaching:\nMindset (${prevCoaching.mindset_score}/5): ${prevCoaching.mindset_diagnose}\nSysteem (${prevCoaching.systeem_score}/5): ${prevCoaching.systeem_diagnose}\nActie (${prevCoaching.actie_score}/5): ${prevCoaching.actie_diagnose}\n\nNieuwe gesprekken:\n${newSessiesText || '(geen)'}\n\nNieuwe analyses:\n${newAnalysesText || '(geen)'}${newSparringText}\n\nIs er kwalitatief iets veranderd in het patroon?`,
          }],
        }))
        // Leeg antwoord behandelen we hetzelfde als een gegooide fout hieronder: fail-open
        // naar "ja", nooit fail-closed. Een technisch mankement in de precheck mag nooit een
        // gebruiker blokkeren die zelf niets fout heeft gedaan.
        const rawPrecheck = getText(precheck.content, '')
        if (!rawPrecheck) console.error('[coaching precheck] leeg antwoord, behandel als "ja"')
        precheckText = rawPrecheck ? rawPrecheck.trim().toLowerCase() : 'ja'
      } catch (err: any) {
        console.error('[coaching precheck error]', err?.status, err?.message ?? err)
        // precheck mislukt: laat generatie door, behandel als "ja"
        precheckText = 'ja'
      }

      const verdict = precheckText
      if (!verdict.startsWith('ja')) {
        if (forceAllow) {
          weinig_voortgang = true
          if (prevWeinigVoortgang) stagnatie = true
        } else {
          return NextResponse.json({ error: blockError }, { status: 429 })
        }
      }
    } else {
      if (forceAllow) {
        weinig_voortgang = true
        if (prevWeinigVoortgang) stagnatie = true
      } else {
        return NextResponse.json({ error: blockError }, { status: 429 })
      }
    }
  }
  // Actieopvolging patroon berekenen
  const actieStatussen = (actieStatRes.data ?? []).map(s => s.actie_status as string)
  const recent = actieStatussen.slice(0, 5)
  const aantalNee = recent.filter(s => s === 'nee').length
  const aantalDeels = recent.filter(s => s === 'deels').length
  const aantalJa = recent.filter(s => s === 'ja').length
  const recentLabels = recent.map(s => s === 'ja' ? 'gedaan' : s === 'deels' ? 'ingepland' : 'niet gedaan').join(', ')

  let actieOpvolgingContext = ''
  if (recent.length >= 4) {
    if (aantalNee >= 3) {
      actieOpvolgingContext = `\n\nACTIEOPVOLGING: De gebruiker geeft bij het begin van sessies aan of de vorige actie is gedaan. Recente antwoorden (meest recent eerst): ${recentLabels}. Dit is een duidelijk patroon: acties worden structureel niet opgepakt. Benoem dit direct in de actie_diagnose zonder omwegen. Geen aannames over de reden want de volledige context is niet altijd zichtbaar. Het patroon zelf is een feit, de reden niet. Sluit af met een open vraag: "Wat speelt er bij je?" Arno doet dit niet om te controleren maar omdat zijn enige drive is dat de gebruiker beter presteert en succesvol wordt. Eerlijk en direct vanuit oprechte betrokkenheid.`
    } else if (aantalDeels >= 3) {
      actieOpvolgingContext = `\n\nACTIEOPVOLGING: De gebruiker geeft bij het begin van sessies aan of de vorige actie is gedaan. Recente antwoorden (meest recent eerst): ${recentLabels}. Patroon: acties worden structureel ingepland maar niet afgerond. Benoem dit direct in de actie_diagnose. Geen aannames over de reden want de volledige context is niet altijd zichtbaar. Sluit af met een open vraag: "Wat speelt er bij je?" Arno doet dit niet om te controleren maar omdat zijn enige drive is dat de gebruiker beter presteert en succesvol wordt.`
    } else if (aantalJa >= 4) {
      actieOpvolgingContext = `\n\nACTIEOPVOLGING: De gebruiker geeft bij het begin van sessies aan of de vorige actie is gedaan. Recente antwoorden (meest recent eerst): ${recentLabels}. Patroon: de gebruiker zet afspraken consequent om in actie. Verwerk dit als positief signaal in de actie_diagnose.`
    }
  }

  // Signalen: korte, feitelijke observaties op basis van tellingen, geen AI-oordeel nodig.
  // BEWUST buiten de AI-call om (rechtstreeks in JS): dit zijn losse tips, geen onderdeel van de
  // kernscoring. Nieuwe tips van dit type horen HIER thuis, niet in de systeemprompt hieronder,
  // anders verdrukken ze de mindset/systeem/actie-diagnoses die wel AI-interpretatie vereisen.
  const signalen: string[] = []
  const analyseRatio = analyses.length / Math.max(totalSessionCount, 1)
  if (totalSessionCount >= 10 && analyseRatio < 0.2) {
    signalen.push(`Je hebt ${totalSessionCount} gesprekken gevoerd maar pas ${analyses.length} ${analyses.length === 1 ? 'analyse' : 'analyses'} gemaakt. Groei gaat het snelst via de route gesprek naar analyse naar coaching.`)
  }
  if (totalSessionCount >= 10 && sparringSessions.length === 0) {
    signalen.push(`Je hebt ${totalSessionCount} coaching-gesprekken gevoerd maar nog niet gesparred. Oefenen in sparring helpt om wat je hier bespreekt ook echt te trainen.`)
  }

  // Significante scoreverbeteringen detecteren (2+ punten stijging)
  let voortgangErkenningContext = ''
  if (prevCoaching?.mindset_score != null) {
    const pijlarNamen: Record<string, string> = { mindset: 'Mindset', systeem: 'Systeem', actie: 'Actie' }
    const sprongen: string[] = []
    const pijlars = [
      { key: 'mindset', prev: prevCoaching.mindset_score, naam: 'Mindset' },
      { key: 'systeem', prev: prevCoaching.systeem_score, naam: 'Systeem' },
      { key: 'actie', prev: prevCoaching.actie_score, naam: 'Actie' },
    ]
    // We weten de nieuwe scores nog niet (die bepaalt het model), maar we geven het model
    // de instructie om significante stijgingen te erkennen als het ze berekent.
    // Drempel: 2+ punten op een 1-5 schaal is significant.
    voortgangErkenningContext = `\n\nVOORTGANGSERKENNING: Vorige scores waren Mindset ${prevCoaching.mindset_score}/5, Systeem ${prevCoaching.systeem_score}/5, Actie ${prevCoaching.actie_score}/5. Als een pijlar met 2 of meer punten is gestegen ten opzichte van deze vorige scores, erken dat expliciet in de betreffende diagnose. Kort en direct, geen overdreven lof. Bijv. "Je systeemscore is gestegen van ${prevCoaching.systeem_score} naar [score]. Dat is een reële verbetering." Geen erkenning bij 1 punt stijging of minder.`
  }

  const profiel = profielRes.data?.profiel ?? null
  const profielText = profiel
    ? `\n\nGEBRUIKERSPROFIEL:\nRol: ${profiel.rol || 'onbekend'}\nMarkt: ${Array.isArray(profiel.markt) ? profiel.markt.join(', ') : profiel.markt || 'onbekend'}\nWat verkoop je: ${profiel.wat_verkoop_je || 'onbekend'}\nIdeale klant: ${profiel.ideale_klant || 'onbekend'}\nGrootste uitdaging: ${profiel.uitdaging || 'onbekend'}`
    : ''

  const prevSessionIds = new Set<string>(prevCoaching?.used_session_ids ?? [])
  const prevAnalyseIds = new Set<string>(prevCoaching?.used_analyse_ids ?? [])
  const newSessionCount = prevCoaching ? sessions.filter(s => !prevSessionIds.has(s.session_id)).length : sessions.length
  const newAnalyseCount = prevCoaching ? analyses.filter(a => !prevAnalyseIds.has(a.id)).length : analyses.length

  const deltaContext = prevCoaching
    ? `\n\nVORIGE COACHING (ter vergelijking: ${newSessionCount} nieuwe gesprekken en ${newAnalyseCount} nieuwe analyses sindsdien):\nVoortgang: ${prevCoaching.voortgang}\nMindset (${prevCoaching.mindset_score}/5): ${prevCoaching.mindset_diagnose}\nSysteem (${prevCoaching.systeem_score}/5): ${prevCoaching.systeem_diagnose}\nActie (${prevCoaching.actie_score}/5): ${prevCoaching.actie_diagnose}`
    : ''

  const sessiesText = sessions
    .map((s, i) =>
      `Gesprek ${i + 1} (${new Date(s.created_at).toLocaleDateString('nl-NL')}, ${s.message_count} vragen): ${s.title}${s.summary ? `\nSamenvatting: ${s.summary}` : ''}${s.feiten ? `\nFeiten: ${s.feiten}` : ''}`
    )
    .join('\n\n')

  const analysesText = analyses.length > 0
    ? '\n\nEERDERE PATROONANALYSES (meest recent eerst):\n' + analyses
        .map((a, i) =>
          `Analyse ${i + 1} (${new Date(a.created_at).toLocaleDateString('nl-NL')}, ${a.session_count} gesprekken):\n${a.analyse_text}`
        )
        .join('\n\n')
    : ''

  const sparringText = sparringSessions.length > 0
    ? '\n\nSPARRING-OEFENSESSIES (gesimuleerde verkoopgesprekken tegen een tegenstander-persona, meest recent eerst):\n' + sparringSessions
        .map((s, i) =>
          `Sparring ${i + 1} (${new Date(s.created_at).toLocaleDateString('nl-NL')}, rol: ${s.rol_categorie || 'onbekend'}, weerstand: ${s.weerstand || 'onbekend'}, ${s.message_count} berichten):\n${s.debrief}`
        )
        .join('\n\n')
    : ''

  let response
  try {
    response = await Sentry.startSpan({ name: 'coaching.main-synthesis', op: 'ai.claude' }, () => anthropic.messages.create({
    model: 'claude-fable-5',
    max_tokens: 4000,
    system: `Je bent Arno Diepeveen. Salesstrateeg met 40 jaar ervaring, 30 jaar bedrijven bouwen, 20 jaar blogs schrijven en 15 jaar scaling up coach en mentor. Direct en ongefilterd. Je schrijft een persoonlijk coachingsdocument gebaseerd op drie pijlers: Mindset, Systeem en Actie. Geen corporate coachtaal. Geen bullshit. Geen accenten op woorden voor nadruk. Gebruik het woord "moeten" niet; gebruik alternatieven als "kun je", "wil je", "loont het om". Spreek de gebruiker aan met "je". Schrijf ontwikkelpunten zonder tijdslimiet: geen "vandaag", "morgen", "deze week".

MINDSET = hoe iemand in de wedstrijd zit. Geloof in zichzelf, zelfimage als verkoper, positief of negatief taalgebruik, excuses maken of verantwoordelijkheid nemen.
SYSTEEM = heeft iemand een verkoopproces? Volgt die dat consequent? Pipeline-denken, opvolging, structuur, terugkomen op dingen. Sales is een proces, geen vak.
ACTIE = doet iemand het ook echt? Gesprekken voeren, initiatief nemen, consistent actief blijven. Een droom zonder actie is een nachtmerrie.

SPARRING = naast coaching-gesprekken kan de gebruiker ook oefenen in gesimuleerde verkoopgesprekken tegen een tegenstander-persona. Dit is een laagdrempelige oefenruimte, geen examen: beoordeel losse sparring-momenten niet te streng en trek geen harde conclusies uit één minder sterk oefenmoment. Sparring is een aanvullend signaal, geen vervanging van de echte coaching-gesprekken: het zegt vooral iets over ACTIE (oefent iemand actief, hoe vaak) en MINDSET (hoe gaat iemand om met weerstand en tegenwerking in een simulatie). Weeg sparring-sessies mee in score en diagnose van deze twee pijlars als ze aanwezig zijn, maar baseer de kern van de analyse op de echte coaching-gesprekken. Zijn er geen sparring-sessies aangeleverd, ga er dan van uit dat de gebruiker deze functie simpelweg niet gebruikt: noem het ontbreken ervan niet als tekortkoming en laat het nooit de mindset- of actie-score verlagen. Sparring is een bonus, geen verplichting.

Score elke pijlar op een schaal van 1 (zwak) tot 5 (sterk) op basis van wat de gesprekken onthullen.
Bepaal richting op basis van hoe gesprekken zich over tijd ontwikkelen: worden ze dieper, concreter, meer gericht? Stijgend. Draaien ze in cirkels? Dalend. Geen duidelijke beweging? Stabiel.

Return ALLEEN een JSON-object, geen uitleg, geen markdown eromheen:
{
  "voortgang": "1-2 zinnen: worden de vragen dieper en concreter over tijd, of draaien ze in cirkels? Wees eerlijk.",
  "mindset_score": <getal 1 t/m 5>,
  "mindset_diagnose": "2-3 zinnen over de mindset die je ziet. Wat verraadt het taalgebruik, de vragen, de houding?",
  "mindset_richting": "stijgend",
  "systeem_score": <getal 1 t/m 5>,
  "systeem_diagnose": "2-3 zinnen over het systeemdenken. Zit er structuur in de vragen of is het elke keer ad hoc?",
  "systeem_richting": "stabiel",
  "actie_score": <getal 1 t/m 5>,
  "actie_diagnose": "2-3 zinnen over actiegericht gedrag. Hoe actief is iemand, worden vragen concreter over tijd?",
  "actie_richting": "stijgend",
  "ontwikkelpunten": [
    { "tekst": "Meest urgente ontwikkelpunt, één zin, direct en actiegericht, zonder tijdslimiet", "pijlar": "mindset of systeem of actie" },
    { "tekst": "Tweede meest urgente ontwikkelpunt, één zin, direct en actiegericht, zonder tijdslimiet", "pijlar": "mindset of systeem of actie" },
    { "tekst": "Derde meest urgente ontwikkelpunt, één zin, direct en actiegericht, zonder tijdslimiet", "pijlar": "mindset of systeem of actie" }
  ]

Kies de drie meest urgente ontwikkelpunten op basis van de laagste scores en sterkste patronen. De verdeling over de pijlars hoeft niet gelijk te zijn: twee punten op dezelfde pijlar is prima als de data dat vraagt.
}

De richting-waarden mogen alleen zijn: "stijgend", "stabiel" of "dalend".
De pijlar-waarden mogen alleen zijn: "mindset", "systeem" of "actie".
Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.

${RULE_ENGLISH_TERMS}

${RULE_NO_CRUDE_LANGUAGE}

${RULE_NEVER_BREAK_CHARACTER}

${RULE_NO_INVENTED_DETAILS}
${actieOpvolgingContext}${voortgangErkenningContext}${stagnatie ? '\n\nBELANGRIJK: Er is sprake van hardnekkige stagnatie. De gebruiker zit al meerdere coaching-rondes in hetzelfde patroon. Benoem dit expliciet en geef directe, confronterende actieadviezen. Concreet gedrag, geen zachte aanmoedigingen.' : weinig_voortgang ? '\n\nBELANGRIJK: Er is weinig kwalitatieve verandering zichtbaar in de nieuwe gesprekken. Geef in de ontwikkelpunten extra specifieke, directe acties. Concreet gedrag, geen algemene adviezen.' : ''}`,
    messages: [{
      role: 'user',
      content: `Analyseer deze ${sessions.length} gesprekken${analyses.length > 0 ? ` en ${analyses.length} eerder gemaakte patroonanalyses` : ''}${sparringSessions.length > 0 ? ` en ${sparringSessions.length} sparring-oefensessies` : ''} en schrijf een coachingsdocument:${profielText}${deltaContext}\n\nGESPREKKEN:\n${sessiesText}${analysesText}${sparringText}`
    }]
  }))
  } catch (err: any) {
    console.error('[coaching generate error]', err?.status, err?.message ?? err)
    return NextResponse.json({ error: 'generate_error', detail: `${err?.status ?? 'no-status'}: ${err?.message ?? String(err)}` }, { status: 500 })
  }

  if (response.stop_reason === 'refusal') {
    console.error('[coaching refusal]', response.stop_reason)
    return NextResponse.json({ error: 'generate_error', detail: 'refusal' }, { status: 500 })
  }

  const raw = getText(response.content)

  let parsed: {
    voortgang: string
    mindset_score: number
    mindset_diagnose: string
    mindset_richting: string
    systeem_score: number
    systeem_diagnose: string
    systeem_richting: string
    actie_score: number
    actie_diagnose: string
    actie_richting: string
    ontwikkelpunten: { tekst: string; pijlar: string }[]
  }

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch?.[0] ?? raw)
  } catch {
    return NextResponse.json({ error: 'parse_error' }, { status: 500 })
  }

  // Richting berekenen op basis van vorige score, niet LLM-gissing
  const prev = prevScoreRes.data
  if (prev) {
    const r = (curr: number, p: number) => curr > p ? 'stijgend' : curr < p ? 'dalend' : 'stabiel'
    parsed.mindset_richting = r(parsed.mindset_score, prev.mindset_score)
    parsed.systeem_richting = r(parsed.systeem_score, prev.systeem_score)
    parsed.actie_richting = r(parsed.actie_score, prev.actie_score)
  }

  type Blog = { title: string; url: string; reden: string }
  const blogs: Blog[] = []
  try {
    // 3 parallelle RAG-queries — één per ontwikkelpunt voor precieze matching
    const ragResults = await Sentry.startSpan({ name: 'coaching.rag-lookup', op: 'db.rag' }, () =>
      Promise.all(parsed.ontwikkelpunten.map(p => getRelevantChunks(p.tekst, 8)))
    )

    // Bouw een map van url → { title, chunks, punten }
    // Als een blog meerdere punten matcht, worden alle fragmenten en punten bewaard
    type BlogCandidate = { title: string; chunks: string[]; punten: string[] }
    const blogMap = new Map<string, BlogCandidate>()

    for (let i = 0; i < parsed.ontwikkelpunten.length; i++) {
      const punt = parsed.ontwikkelpunten[i].tekst
      for (const c of ragResults[i]) {
        if (!c.url || !c.source || !c.url.includes('arno.blog')) continue
        if (!blogMap.has(c.url)) {
          blogMap.set(c.url, {
            title: c.source.replace(/\s*\([^)]+\)\s*$/, ''),
            chunks: [c.content.slice(0, 400)],
            punten: [punt],
          })
        } else {
          const existing = blogMap.get(c.url)!
          if (!existing.punten.includes(punt)) {
            existing.punten.push(punt)
            existing.chunks.push(c.content.slice(0, 250))
          }
        }
        break // beste match per punt is voldoende
      }
    }

    const candidates = [...blogMap.entries()].slice(0, 3)

    if (candidates.length > 0) {
      // Kleine Claude-call voor synthese per blog op basis van echte fragmenten
      const synthContext = candidates.map(([url, b], i) =>
        `Blog ${i + 1}: "${b.title}" (${url})\nRelevant voor: ${b.punten.join(' + ')}\nFragment(en):\n${b.chunks.join('\n---\n')}`
      ).join('\n\n===\n\n')

      const synthResponse = await Sentry.startSpan({ name: 'coaching.blog-synthesis', op: 'ai.claude' }, () =>
        anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: `Je bent Arno Diepeveen. Schrijf per blog één korte zin in gewone spreektaal die uitlegt wat iemand uit dit blog haalt. Geen formele taal, geen jargon, geen lange zinnen. Schrijf zoals je het aan een vriend uitlegt. Begin met "Hier leer je..." of "Dit legt uit hoe je..." of iets vergelijkbaars. Kort, concreet, actiegericht.

Return ALLEEN een JSON array, geen uitleg eromheen:
[{ "url": "...", "reden": "..." }]
Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken).`,
          messages: [{ role: 'user', content: synthContext }],
        })
      )

      const synthRaw = getText(synthResponse.content)
      const synthMatch = synthRaw.match(/\[[\s\S]*\]/)
      const synthParsed: { url: string; reden: string }[] = JSON.parse(synthMatch?.[0] ?? '[]')

      for (const [url, b] of candidates) {
        const synth = synthParsed.find(s => s.url === url)
        blogs.push({ title: b.title, url, reden: synth?.reden ?? '' })
      }
    }
  } catch {}

  const doc = { ...parsed, blogs, conversation_count: totalSessionCount, weinig_voortgang, stagnatie, signalen }
  const payload = {
    ...doc,
    updated_at: new Date().toISOString(),
    used_session_ids: sessions.map(s => s.session_id),
    used_analyse_ids: analyses.map(a => a.id),
  }

  const { data: existing } = await supabase
    .from('arnobot_coaching')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  const saveResult = existing
    ? await supabase.from('arnobot_coaching').update(payload).eq('user_id', userId)
    : await supabase.from('arnobot_coaching').insert({ user_id: userId, ...payload })

  if (saveResult.error) console.error('[coaching POST save]', saveResult.error.message)

  // Notificatie naar manager als dit een teamlid is
  const { data: membership } = await supabase
    .from('arnobot_team_members')
    .select('team_id, display_name')
    .eq('user_id', userId)
    .neq('role', 'manager')
    .maybeSingle()

  if (membership) {
    const { data: manager } = await supabase
      .from('arnobot_team_members')
      .select('user_id')
      .eq('team_id', membership.team_id)
      .eq('role', 'manager')
      .maybeSingle()

    if (manager) {
      await supabase.from('arnobot_team_notifications').insert({
        team_id: membership.team_id,
        manager_id: manager.user_id,
        type: 'coaching_gegenereerd',
        member_id: userId,
        member_name: membership.display_name ?? 'Teamlid',
        ref_id: null,
      })
    }
  }

  const msaScore = computeMsaScore(parsed.mindset_score, parsed.systeem_score, parsed.actie_score)
  const prevScore = prevScoreRes.data as { mindset_score: number; systeem_score: number; actie_score: number; created_at: string } | null
  const canSaveScore = !prevScore || (() => {
    const hoursSince = (Date.now() - new Date(prevScore.created_at).getTime()) / 3600000
    if (hoursSince >= 48) return true
    return sessions.filter(s => s.created_at > prevScore.created_at).length >= 10
  })()
  if (canSaveScore) {
    const { error: scoreErr } = await supabase.from('arnobot_coaching_scores').insert({
      user_id: userId,
      mindset_score: parsed.mindset_score,
      systeem_score: parsed.systeem_score,
      actie_score: parsed.actie_score,
      msa_score: msaScore,
    })
    if (scoreErr) console.error('[coaching scores insert]', scoreErr.message)
  }

  // Geschiedenis van eerdere coachingsrapportages, analoog aan arnobot_team_analyses:
  // aparte insert-only tabel naast arnobot_coaching (dat 1 rij per gebruiker blijft),
  // zodat geen van de bestaande .single()/.maybeSingle()-consumers van arnobot_coaching geraakt wordt.
  const { error: historyErr } = await supabase.from('arnobot_coaching_history').insert({
    user_id: userId,
    mindset_score: doc.mindset_score,
    mindset_diagnose: doc.mindset_diagnose,
    systeem_score: doc.systeem_score,
    systeem_diagnose: doc.systeem_diagnose,
    actie_score: doc.actie_score,
    actie_diagnose: doc.actie_diagnose,
    voortgang: doc.voortgang,
  })
  if (historyErr) console.error('[coaching history insert]', historyErr.message)
  // Bewust geen opruiming/cap op arnobot_coaching_history: coachingsrapporten komen traag
  // binnen (voortgang-gate, 48u+3 gesprekken), dus een cap zou op termijn de nulmeting van
  // een trouwe gebruiker wegknippen. Opslagkosten zijn verwaarloosbaar op deze frequentie.

  return NextResponse.json({ coaching: doc })
}
