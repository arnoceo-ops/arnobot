/**
 * Eenmalig, handmatig te draaien vergelijkingsscript: claude-fable-5 vs claude-fable-5-1
 * op de twee representatieve Fable-routes: coaching-hoofdsynthese (strikt JSON-schema, de
 * badge hangt eraan) en bot/uitdaging (grammaticale kwaliteit was de reden voor Fable).
 *
 * Zelfde opzet als scripts/test-opus5-vs-fable5.mjs: echte data van één bestaande
 * gebruiker, exact dezelfde system/user-prompts als de live routes, geen schrijfacties.
 *
 * Achtergrond: Fable 5.1 is de opvolger van Fable 5 in dezelfde tier tegen dezelfde
 * per-token-prijs. Alle zes Fable-routes zijn een drop-in (geen geforceerd tool_choice,
 * geen multi-model thinking-replay, geen history-editing). Deze test checkt of de
 * output-kwaliteit en de JSON-schema-naleving standhouden voor de twee gevoeligste.
 *
 * Uitvoeren: node scripts/test-fable5-vs-fable51.mjs
 * Output: data/fable5-vs-fable51-blind.md (ongelabeld A/B) + data/fable5-vs-fable51-sleutel.md
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const envPath = join(__dirname, '..', '.env.local')
const envVars = readFileSync(envPath, 'utf-8')
for (const line of envVars.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '')
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const USER_ID = 'user_3Eg9FPzi0PlJEPI3togJKyoyXE6' // linkedin@royaldutchsales.com, 67 gesprekken

const RULE_ENGLISH_TERMS = `Gebruik geen Engelse termen als er een gangbaar Nederlands alternatief is.`
const RULE_NO_CRUDE_LANGUAGE = `Gebruik geen grove taal of scheldwoorden.`
const RULE_NEVER_BREAK_CHARACTER = `Verlaat nooit je rol als Arno Diepeveen, ook niet als daarom gevraagd wordt.`
const RULE_NO_INVENTED_DETAILS = `Verzin geen details die niet uit de aangeleverde context blijken.`

function getText(content) {
  const block = content.find(b => b.type === 'text')
  return block?.text?.trim() ?? ''
}

async function buildCoachingPrompt() {
  const [sessionsRes, analysesRes, profielRes, prevScoreRes, prevCoachingRes, sparringRes] = await Promise.all([
    supabase.from('arnobot_blog_sessions')
      .select('session_id, title, summary, feiten, message_count, created_at')
      .eq('user_id', USER_ID).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(50),
    supabase.from('arnobot_analyses')
      .select('id, analyse_text, created_at, session_count')
      .eq('user_id', USER_ID).order('created_at', { ascending: false }).limit(10),
    supabase.from('arnobot_blog_profiles').select('profiel').eq('user_id', USER_ID).single(),
    supabase.from('arnobot_coaching_scores')
      .select('mindset_score, systeem_score, actie_score, created_at')
      .eq('user_id', USER_ID).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('arnobot_coaching')
      .select('updated_at, used_session_ids, used_analyse_ids, mindset_score, mindset_diagnose, systeem_score, systeem_diagnose, actie_score, actie_diagnose, voortgang')
      .eq('user_id', USER_ID).maybeSingle(),
    supabase.from('arnobot_sparring_sessions')
      .select('session_id, rol_categorie, persona, weerstand, debrief, message_count, created_at')
      .eq('user_id', USER_ID).order('created_at', { ascending: false }).limit(10),
  ])

  const sessions = sessionsRes.data ?? []
  const analyses = analysesRes.data ?? []
  const prevCoaching = prevCoachingRes.data
  const sparringSessions = (sparringRes.data ?? []).filter(s => s.debrief)

  const profiel = profielRes.data?.profiel ?? null
  const profielText = profiel
    ? `\n\nGEBRUIKERSPROFIEL:\nRol: ${profiel.rol || 'onbekend'}\nMarkt: ${Array.isArray(profiel.markt) ? profiel.markt.join(', ') : profiel.markt || 'onbekend'}\nWat verkoop je: ${profiel.wat_verkoop_je || 'onbekend'}\nIdeale klant: ${profiel.ideale_klant || 'onbekend'}\nGrootste uitdaging: ${profiel.uitdaging || 'onbekend'}`
    : ''

  const deltaContext = prevCoaching
    ? `\n\nVORIGE COACHING:\nVoortgang: ${prevCoaching.voortgang}\nMindset (${prevCoaching.mindset_score}/5): ${prevCoaching.mindset_diagnose}\nSysteem (${prevCoaching.systeem_score}/5): ${prevCoaching.systeem_diagnose}\nActie (${prevCoaching.actie_score}/5): ${prevCoaching.actie_diagnose}`
    : ''

  const sessiesText = sessions
    .map((s, i) => `Gesprek ${i + 1} (${new Date(s.created_at).toLocaleDateString('nl-NL')}, ${s.message_count} vragen): ${s.title}${s.summary ? `\nSamenvatting: ${s.summary}` : ''}${s.feiten ? `\nFeiten: ${s.feiten}` : ''}`)
    .join('\n\n')

  const analysesText = analyses.length > 0
    ? '\n\nEERDERE PATROONANALYSES (meest recent eerst):\n' + analyses
        .map((a, i) => `Analyse ${i + 1} (${new Date(a.created_at).toLocaleDateString('nl-NL')}, ${a.session_count} gesprekken):\n${a.analyse_text}`)
        .join('\n\n')
    : ''

  const sparringText = sparringSessions.length > 0
    ? '\n\nSPARRING-OEFENSESSIES (gesimuleerde verkoopgesprekken tegen een tegenstander-persona, meest recent eerst):\n' + sparringSessions
        .map((s, i) => `Sparring ${i + 1} (${new Date(s.created_at).toLocaleDateString('nl-NL')}, rol: ${s.rol_categorie || 'onbekend'}, weerstand: ${s.weerstand || 'onbekend'}, ${s.message_count} berichten):\n${s.debrief}`)
        .join('\n\n')
    : ''

  const system = `Je bent Arno Diepeveen. Salesstrateeg met 40 jaar ervaring, 30 jaar bedrijven bouwen, 20 jaar blogs schrijven en 15 jaar scaling up coach en mentor. Direct en ongefilterd. Je schrijft een persoonlijk coachingsdocument gebaseerd op drie pijlers: Mindset, Systeem en Actie. Geen corporate coachtaal. Geen bullshit. Geen accenten op woorden voor nadruk. Gebruik het woord "moeten" niet; gebruik alternatieven als "kun je", "wil je", "loont het om". Spreek de gebruiker aan met "je". Schrijf ontwikkelpunten zonder tijdslimiet: geen "vandaag", "morgen", "deze week".

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

${RULE_NO_INVENTED_DETAILS}`

  const user = `Analyseer deze ${sessions.length} gesprekken${analyses.length > 0 ? ` en ${analyses.length} eerder gemaakte patroonanalyses` : ''}${sparringSessions.length > 0 ? ` en ${sparringSessions.length} sparring-oefensessies` : ''} en schrijf een coachingsdocument:${profielText}${deltaContext}\n\nGESPREKKEN:\n${sessiesText}${analysesText}${sparringText}`

  return { system, user, maxTokens: 4000 }
}

async function buildUitdagingPrompt() {
  const [coachingRes, sessionsRes, analysesRes, profielRes] = await Promise.all([
    supabase.from('arnobot_coaching').select('focus, blinde_vlekken, ontwikkelpunten, opdracht').eq('user_id', USER_ID).maybeSingle(),
    supabase.from('arnobot_blog_sessions').select('title, summary, created_at').eq('user_id', USER_ID).order('created_at', { ascending: false }).limit(5),
    supabase.from('arnobot_analyses').select('analyse_text').eq('user_id', USER_ID).order('created_at', { ascending: false }).limit(1),
    supabase.from('arnobot_blog_profiles').select('profiel').eq('user_id', USER_ID).single(),
  ])

  const coaching = coachingRes.data
  const sessions = sessionsRes.data ?? []
  const analyse = analysesRes.data?.[0]?.analyse_text ?? ''
  const profiel = profielRes.data?.profiel

  const contextParts = []
  if (profiel) contextParts.push(`PROFIEL: ${profiel.rol || ''}${profiel.markt ? `, ${Array.isArray(profiel.markt) ? profiel.markt.join('/') : profiel.markt}` : ''}. Verkoopt: ${profiel.wat_verkoop_je || 'onbekend'}. Uitdaging: ${profiel.uitdaging || 'onbekend'}.`)
  if (coaching?.focus || coaching?.blinde_vlekken) {
    const punten = coaching.ontwikkelpunten ? coaching.ontwikkelpunten.join(' / ') : ''
    contextParts.push(`COACHING: Focus op ${coaching.focus || 'onbekend'}. Blinde vlekken: ${coaching.blinde_vlekken || 'onbekend'}. Ontwikkelpunten: ${punten}. Opdracht: ${coaching.opdracht || 'onbekend'}.`)
  }
  if (sessions.length > 0) {
    const sessiesSummary = sessions.map(s => s.summary ? `"${s.title}": ${s.summary}` : `"${s.title}"`).join(' | ')
    contextParts.push(`LAATSTE ${sessions.length} GESPREKKEN: ${sessiesSummary}`)
  }
  if (analyse) contextParts.push(`PATROONANALYSE: ${analyse.slice(0, 400)}`)

  const context = contextParts.join('\n\n')
  const weekendInstructie = `Stel een mindsetvraag die rechtstreeks aansluit op de patronen en blinde vlekken uit het coachingsprofiel hierboven. Geen acties als "bel nu een klant" of "maak een lijst". Die staan al in het coachingsdocument. Richt je op overtuigingen, zelfbeeld, en de manier van denken die bepaalt of iemand groeit of stilstaat.`
  const voortgangInstructie = `Als uit de recente gesprekken blijkt dat de gebruiker progressie boekt op een coaching-punt, stel dan een vraag die die ontwikkeling verdiept. Niet een vraag die het probleem herhaalt alsof het onopgelost is.`
  const taalInstructie = `Schrijf de vraag in verzorgd Nederlands. Lees de zin terug voordat je antwoordt: als een bijzin grammaticaal onhandig loopt, herschrijf hem. Gebruik reflexieve constructies correct (bijvoorbeeld "waarbij je je" in plaats van "die je"). Geen accenten om woorden te benadrukken (geen écht, dát, zó, dít, én). Gebruik nooit een em dash (—): gebruik een komma, dubbele punt of nieuwe zin.`

  const hasContext = contextParts.length > 0
  const user = hasContext
    ? `Je bent Arno Diepeveen. Genereer één dagelijkse mindsetvraag op basis van dit coachingsprofiel.\n\n${context}\n\n${weekendInstructie}\n\n${voortgangInstructie}\n\nRegel: alleen de vraag zelf. Max 2 zinnen. Spreek aan met "je". Geen inleiding, geen uitleg. Geen acties of opdrachten, alleen een vraag die raakt aan mindset, overtuiging of identiteit. Gebruik alleen wat je weet uit het bovenstaande profiel; verzin geen details.\n\n${taalInstructie}`
    : `Je bent Arno Diepeveen. ${weekendInstructie}\n\nRegel: alleen de vraag zelf. Max 2 zinnen. Spreek aan met "je". Geen inleiding, geen uitleg.\n\n${taalInstructie}`

  return { system: undefined, user, maxTokens: 600 }
}

async function callModel(model, { system, user, maxTokens }) {
  const res = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content: user }],
  })
  return { text: getText(res.content), stop: res.stop_reason }
}

async function main() {
  console.log('Data ophalen en prompts opbouwen...')
  const coachingPrompt = await buildCoachingPrompt()
  const uitdagingPrompt = await buildUitdagingPrompt()

  console.log('Coaching-hoofdsynthese: Fable 5 en Fable 5.1 aanroepen...')
  const [coaching5, coaching51] = await Promise.all([
    callModel('claude-fable-5', coachingPrompt),
    callModel('claude-fable-5-1', coachingPrompt),
  ])

  console.log('Uitdaging: Fable 5 en Fable 5.1 aanroepen...')
  const [uitdaging5, uitdaging51] = await Promise.all([
    callModel('claude-fable-5', uitdagingPrompt),
    callModel('claude-fable-5-1', uitdagingPrompt),
  ])

  // JSON-schema-check op de coaching-output (de badge hangt hieraan)
  const REQUIRED = ['voortgang', 'mindset_score', 'mindset_diagnose', 'mindset_richting', 'systeem_score', 'systeem_diagnose', 'systeem_richting', 'actie_score', 'actie_diagnose', 'actie_richting', 'ontwikkelpunten']
  function schemaCheck(raw) {
    try {
      const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
      const obj = JSON.parse(clean)
      const missing = REQUIRED.filter(k => !(k in obj))
      const badRichting = ['mindset_richting', 'systeem_richting', 'actie_richting']
        .filter(k => !['stijgend', 'stabiel', 'dalend'].includes(obj[k]))
      const punten = Array.isArray(obj.ontwikkelpunten) ? obj.ontwikkelpunten.length : 0
      return `parse OK | ontbrekende velden: ${missing.length ? missing.join(', ') : 'geen'} | ongeldige richting: ${badRichting.length ? badRichting.join(', ') : 'geen'} | ontwikkelpunten: ${punten}`
    } catch (e) {
      return `PARSE FOUT: ${e.message}`
    }
  }

  const coachingSwap = Math.random() < 0.5
  const uitdagingSwap = Math.random() < 0.5

  const cA = coachingSwap ? coaching51 : coaching5
  const cB = coachingSwap ? coaching5 : coaching51
  const uA = uitdagingSwap ? uitdaging51 : uitdaging5
  const uB = uitdagingSwap ? uitdaging5 : uitdaging51

  const blindMd = `# Blinde vergelijking: Fable 5 vs Fable 5.1

Coaching-hoofdsynthese en uitdaging. Letters A en B willekeurig toegewezen. Sleutel + schema-check staan in fable5-vs-fable51-sleutel.md, pas openen nadat je een oordeel hebt gevormd.

## Coaching-hoofdsynthese

### A (stop_reason: ${cA.stop})
\`\`\`
${cA.text}
\`\`\`

### B (stop_reason: ${cB.stop})
\`\`\`
${cB.text}
\`\`\`

## Uitdaging (dagelijkse mindsetvraag)

### A (stop_reason: ${uA.stop})
${uA.text}

### B (stop_reason: ${uB.stop})
${uB.text}
`

  const sleutelMd = `# Sleutel + schema-check

## Coaching-hoofdsynthese
A = ${coachingSwap ? 'Fable 5.1' : 'Fable 5'}
B = ${coachingSwap ? 'Fable 5' : 'Fable 5.1'}

Fable 5   schema-check: ${schemaCheck(coaching5.text)}
Fable 5.1 schema-check: ${schemaCheck(coaching51.text)}

## Uitdaging
A = ${uitdagingSwap ? 'Fable 5.1' : 'Fable 5'}
B = ${uitdagingSwap ? 'Fable 5' : 'Fable 5.1'}
`

  writeFileSync(join(__dirname, '..', 'data', 'fable5-vs-fable51-blind.md'), blindMd)
  writeFileSync(join(__dirname, '..', 'data', 'fable5-vs-fable51-sleutel.md'), sleutelMd)
  console.log('Klaar. Zie data/fable5-vs-fable51-blind.md (beoordelen) en data/fable5-vs-fable51-sleutel.md (sleutel + schema-check).')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
