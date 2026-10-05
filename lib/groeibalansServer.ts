import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getText } from '@/lib/ai'
import { parseGroeibalansClassificatie } from '@/lib/groeibalans'
import { telGebruik } from '@/lib/gebruikTellers'
import { computeSpiegelSignaal } from '@/lib/spiegel'
import { PERSONA_BESCHRIJVINGEN, SPAR_WEERSTANDEN, isGeldigSparScenario, rolCategorieVoorRol } from '@/lib/sparringPersonas'
import { RULE_JIJ_JOU, RULE_NO_DASH, RULE_NO_TIME_PRESSURE, RULE_NO_INVENTED_DETAILS, RULE_NATUURLIJK_NEDERLANDS } from '@/lib/systemPrompt'

// Herberekening van de "Gebruiksbalans"-classificatie (het kader op /bot, desktop-only, zie
// lib/groeibalans.ts en geheugen project_gebruiksbalans_concept.md). Rolbewust: kijkt naar
// profiel + de zojuist afgeronde activiteit + de huidige tellers, en schrijft het resultaat
// weg op approved_users.groeibalans_*.
//
// Wordt aangeroepen aan het einde van een gewoon gesprek (app/api/bot/session-end/route.ts)
// EN na een afgeronde sparsessie (app/api/sparring/debrief/route.ts). Dat tweede was er eerst
// niet, waardoor het kader een net afgeronde sparsessie pas bij het volgende gewone gesprek
// erkende, en dus niet motiveerde.
//
// Alleen server-side importeren (trekt de Anthropic-SDK mee). lib/groeibalans.ts blijft de
// pure module die ook client-side (SparClient.tsx) veilig te importeren is.

const GROEIBALANS_SYSTEM = `Je beoordeelt of deze gebruiker op dit moment een concrete aanbeveling nodig heeft om meer uit ArnoBot te halen, gegeven zijn rol en huidige gebruik.

ArnoBot heeft vier bouwstenen: gesprekken (vragen stellen), sparsessies (een lastig gesprek oefenen), analyses (patronen laten zien in eigen gesprekken), coaching (een synthese en groeiplan over meerdere gesprekken heen).

Beoordeel of het huidige gebruikspatroon bij de rol van de gebruiker past. Belangrijk: een leidinggevende rol (bijvoorbeeld sales manager, sales director, teamleider) heeft structureel veel minder aan sparsessies dan een verkoper die zelf klantgesprekken voert, dat is geen tekortkoming en geen reden om sparsessies aan te bevelen.

Hoe zwaar sparsessies meetelt in je beoordeling van "state" hangt van diezelfde rol af, als zwaartepunt, niet als rekenformule: bij een verkoper of solopreneur die zelf klantgesprekken voert, weegt sparsessies behoorlijk mee in het totaalbeeld naast gesprekken, analyses en coaching (ruwweg een kwart van het gewicht). Bij een leidinggevende rol weegt sparsessies nauwelijks mee (ruwweg een tiende), coaching en analyses zijn voor hen de belangrijkste signalen. Dit zwaartepunt is een richting, geen harde grens: gebruik je eigen oordeel over het hele gesprek en profiel, en laat bij twijfel dit zwaartepunt de doorslag geven.

Geef ALLEEN een JSON-object terug, geen andere tekst, geen uitleg:
{"tonen": true, "state": "groeikans", "bouwsteen": "sparsessies", "advies": "...", "scenario": {"persona": "cfo", "weerstand": "stevig"}}
of
{"tonen": false}

"tonen": false als het gebruikspatroon, gegeven de rol, al goed en volledig is en er niets zinvols aan te bevelen valt.
"state": "groeikans" bij een duidelijke, nog onbenutte bouwsteen. "neutraal" bij pril gebruik zonder duidelijk patroon. "gezond" bij overwegend goed gebruik met één relatief zwakkere bouwsteen.
"bouwsteen": alleen sparsessies, analyses of coaching, nooit gesprekken.

"advies": één persoonlijke aanbeveling van maximaal twee zinnen (samen onder de 300 tekens), gebaseerd op de GESCHIEDENIS die je meekrijgt: de thema's van recente gesprekken, de laatste sparsessie, de coaching-ontwikkelpunten en bij een teamlid het teamthema. Verwijs concreet naar die inhoud, bijvoorbeeld naar het type klant of bezwaar waar de gebruiker mee bezig is, en leg zo de link met de bouwsteen die je aanbeveelt. Toon: uitnodigend en inspirerend, een uitdaging die energie geeft. Nooit kritiek, nooit een verhoor, nooit een tekortkoming benoemen. Verzin niets dat niet in de geschiedenis staat. Noem geen aantallen, frequenties of datums, dus nooit "meerdere keren", "vaak" of "al een paar". Noem alleen persona's, thema's en onderwerpen die letterlijk in de geschiedenis staan.

"scenario": alleen wanneer bouwsteen sparsessies is. Kies een persona uit de lijst die bij de rol van deze gebruiker hoort en een weerstand (licht, stevig of zwaar) die past bij wat de geschiedenis laat zien. Kies bij voorkeur een scenario dat aansluit op het thema uit de geschiedenis en dat de gebruiker nog niet recent heeft geoefend. Bij een andere bouwsteen laat je "scenario" weg.

${RULE_JIJ_JOU}

${RULE_NO_DASH}

${RULE_NO_TIME_PRESSURE}

${RULE_NO_INVENTED_DETAILS}

${RULE_NATUURLIJK_NEDERLANDS}

Gebruik NOOIT markdown-opmaak. Schrijf platte tekst.`

/**
 * Haalt de historie op waar het persoonlijke advies op gebaseerd wordt: thema's van recente
 * gesprekken, de laatste sparsessies, de coaching-ontwikkelpunten en, bij een teamlid, het
 * dominante teamthema (De Spiegel). Alles per gebruiker gefilterd op user_id.
 */
async function haalGeschiedenis(supabase: SupabaseClient, userId: string): Promise<string> {
  const [sessiesRes, sparRes, coachingRes, lidschapRes] = await Promise.all([
    supabase.from('arnobot_blog_sessions').select('title, themas, created_at')
      .eq('user_id', userId).is('deleted_at', null).eq('community_excluded', false)
      .order('created_at', { ascending: false }).limit(8),
    supabase.from('arnobot_sparring_sessions').select('rol_categorie, persona, weerstand, debrief, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
    supabase.from('arnobot_coaching').select('mindset_score, systeem_score, actie_score, ontwikkelpunten')
      .eq('user_id', userId).maybeSingle(),
    supabase.from('arnobot_team_members').select('team_id, role').eq('user_id', userId).maybeSingle(),
  ])

  const delen: string[] = []

  const sessies = sessiesRes.data ?? []
  if (sessies.length > 0) {
    delen.push('Recente gesprekken (nieuwste eerst):\n' + sessies.map(x => `- ${x.title}${x.themas?.length ? ` (thema's: ${x.themas.join(', ')})` : ''}`).join('\n'))
  }

  const spar = sparRes.data ?? []
  if (spar.length > 0) {
    delen.push('Laatste sparsessies (nieuwste eerst):\n' + spar.map(x =>
      `- tegen ${x.persona ?? 'onbekend'} (${x.rol_categorie ?? 'onbekend'}), weerstand ${x.weerstand ?? 'onbekend'}${x.debrief ? `. Debrief: ${String(x.debrief).replace(/\s+/g, ' ').slice(0, 260)}` : ''}`).join('\n'))
  } else {
    delen.push('Nog geen sparsessies gedaan.')
  }

  const coaching = coachingRes.data
  if (coaching) {
    const punten = (coaching.ontwikkelpunten as { tekst: string; pijlar: string }[] | null) ?? []
    delen.push(`Coaching: mindset ${coaching.mindset_score}/5, systeem ${coaching.systeem_score}/5, actie ${coaching.actie_score}/5.${punten.length ? ' Ontwikkelpunten: ' + punten.map(p => `[${p.pijlar}] ${p.tekst}`).join(' | ') : ''}`)
  }

  // Teamthema alleen voor een gewoon teamlid (geen manager): wat de rest van het team nu ook
  // bezighoudt kan het advies relevanter maken.
  if (lidschapRes.data?.role === 'member' && lidschapRes.data.team_id) {
    const { data: leden } = await supabase.from('arnobot_team_members').select('user_id').eq('team_id', lidschapRes.data.team_id).neq('role', 'manager')
    const spiegel = await computeSpiegelSignaal((leden ?? []).map(l => l.user_id))
    if (!spiegel.onvoldoende && spiegel.dominant) {
      delen.push(`Teamthema van de afgelopen weken (meerdere collega's): ${spiegel.dominant.thema.toLowerCase()}.`)
    }
  }

  return delen.join('\n\n')
}

/**
 * Herberekent de groeibalans-classificatie voor deze gebruiker en schrijft het resultaat weg
 * op approved_users. `activiteit` is een korte beschrijving van wat er zojuist is afgerond
 * (de gesprekstekst, of een samenvatting van de sparsessie), die als context meegaat.
 * Naast de classificatie komt er een persoonlijk advies (en bij sparsessies een voorgesteld
 * scenario) uit de eigen historie, opgeslagen op groeibalans_advies/groeibalans_scenario.
 *
 * Gooit niet zelf verder: de aanroeper wraps dit in `.catch(() => {})`, want een falende
 * classificatie mag de sessie- of debrief-opslag nooit blokkeren (supplementair signaal).
 */
export async function recomputeGroeibalans(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  userId: string,
  activiteit: string,
): Promise<void> {
  const [profielRes, tellers, geschiedenis] = await Promise.all([
    supabase.from('arnobot_blog_profiles').select('profiel').eq('user_id', userId).single(),
    telGebruik(supabase, userId),
    haalGeschiedenis(supabase, userId),
  ])
  const profiel = (profielRes.data?.profiel ?? {}) as Record<string, unknown>
  const rolCategorie = rolCategorieVoorRol(profiel.rol)
  const personaLijst = Object.keys(PERSONA_BESCHRIJVINGEN[rolCategorie] ?? {}).join(', ')

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: GROEIBALANS_SYSTEM,
    messages: [{
      role: 'user',
      content: `Rol: ${profiel.rol ?? 'onbekend'}. Functiejaren: ${profiel.jaren_functie ?? 'onbekend'}. Teamgrootte: ${profiel.teamgrootte ?? 'onbekend'}.

Huidig gebruik in totaal: ${tellers.gesprekken} gesprekken, ${tellers.sparsessies} sparsessies, ${tellers.analyses} analyses, ${tellers.coaching} coachings.

Beschikbare sparscenario's voor deze rol (persona): ${personaLijst}. Weerstanden: ${SPAR_WEERSTANDEN.join(', ')}.

GESCHIEDENIS:
${geschiedenis}

${activiteit}`,
    }],
  })

  const classificatie = parseGroeibalansClassificatie(getText(res.content, '{}'))
  if (!classificatie) return

  const bijgewerkt = new Date().toISOString()
  let update: Record<string, unknown>
  if (classificatie.tonen) {
    // Scenario alleen bewaren als het echt bij deze rolcategorie past en de bouwsteen sparsessies is.
    const scenario = classificatie.bouwsteen === 'sparsessies' && classificatie.scenario
      && isGeldigSparScenario(rolCategorie, classificatie.scenario.persona, classificatie.scenario.weerstand)
      ? classificatie.scenario : null
    update = {
      groeibalans_tonen: true, groeibalans_state: classificatie.state, groeibalans_bouwsteen: classificatie.bouwsteen,
      groeibalans_advies: classificatie.advies ?? null, groeibalans_scenario: scenario, groeibalans_bijgewerkt_op: bijgewerkt,
    }
  } else {
    update = { groeibalans_tonen: false, groeibalans_state: null, groeibalans_bouwsteen: null, groeibalans_advies: null, groeibalans_scenario: null, groeibalans_bijgewerkt_op: bijgewerkt }
  }
  const { error } = await supabase.from('approved_users').update(update).eq('user_id', userId)
  if (error) console.error('[groeibalans] opslaan mislukt:', error.message)
}
