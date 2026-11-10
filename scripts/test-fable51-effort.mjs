/**
 * Eenmalig, handmatig te draaien: coaching-hoofdsynthese op claude-fable-5-1 met denkdiepte
 * (effort) "high" (de standaard) tegen "medium". Doel: sneller genereren zonder kwaliteitsverlies.
 * Echte data van één bestaande gebruiker, dezelfde prompt als scripts/test-fable5-vs-fable51.mjs,
 * geen schrijfacties in de database.
 *
 * Uitvoeren: node scripts/test-fable51-effort.mjs
 * Output: data/effort-blind.md (ongelabeld A/B, beoordelen) en data/effort-sleutel.md (sleutel,
 * tijden en tokens, pas openen na het oordeel). Beide bestanden bevatten gebruikersdata en horen
 * niet in git.
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


const MODEL = 'claude-fable-5-1'

async function callVariant(effort, { system, user, maxTokens }) {
  const start = Date.now()
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    ...(effort === 'high' ? {} : { output_config: { effort } }),
  })
  return {
    effort,
    ms: Date.now() - start,
    outTokens: res.usage.output_tokens,
    inTokens: res.usage.input_tokens,
    stop: res.stop_reason,
    text: getText(res.content),
  }
}

const REQUIRED = ['voortgang', 'mindset_score', 'mindset_diagnose', 'mindset_richting', 'systeem_score', 'systeem_diagnose', 'systeem_richting', 'actie_score', 'actie_diagnose', 'actie_richting', 'ontwikkelpunten']
function schemaCheck(raw) {
  try {
    const van = raw.indexOf('{')
    const tot = raw.lastIndexOf('}')
    const obj = JSON.parse(raw.slice(van, tot + 1))
    const missing = REQUIRED.filter(k => !(k in obj))
    return missing.length ? 'ontbrekende velden: ' + missing.join(', ') : 'schema OK'
  } catch (e) {
    return 'PARSE FOUT: ' + e.message
  }
}

async function main() {
  console.log('Prompt opbouwen uit echte data...')
  const prompt = await buildCoachingPrompt()
  console.log('Vier aanroepen (high en medium, elk twee keer), parallel...')
  const [h1, m1, h2, m2] = await Promise.all([
    callVariant('high', prompt), callVariant('medium', prompt),
    callVariant('high', prompt), callVariant('medium', prompt),
  ])
  const swap = Math.random() < 0.5
  const A = swap ? m1 : h1
  const B = swap ? h1 : m1
  const blind = `# Blinde vergelijking: denkdiepte voor de coaching-hoofdsynthese

Letters A en B zijn willekeurig toegewezen. De sleutel staat in effort-sleutel.md, pas openen na je oordeel.

### A
${A.text}

### B
${B.text}
`
  const fmt = r => `${r.effort.padEnd(6)} | ${(r.ms / 1000).toFixed(1).padStart(5)} s | uitvoer ${r.outTokens} tokens | stop ${r.stop} | ${schemaCheck(r.text)}`
  const sleutel = `# Sleutel

A = ${swap ? 'medium' : 'high'}
B = ${swap ? 'high' : 'medium'}

## Tijden en tokens

${[h1, m1, h2, m2].map(fmt).join('\n')}
`
  writeFileSync(join(__dirname, '..', 'data', 'effort-blind.md'), blind)
  writeFileSync(join(__dirname, '..', 'data', 'effort-sleutel.md'), sleutel)
  console.log('Klaar. Beoordeel data/effort-blind.md. Tijden en sleutel: data/effort-sleutel.md')
  console.log([h1, m1, h2, m2].map(r => r.effort + ' ' + (r.ms / 1000).toFixed(1) + ' s, ' + r.outTokens + ' tokens').join(' | '))
}

main().catch(err => { console.error(err); process.exit(1) })
