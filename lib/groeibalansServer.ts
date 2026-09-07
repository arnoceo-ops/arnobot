import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getText } from '@/lib/ai'
import { parseGroeibalansClassificatie } from '@/lib/groeibalans'
import { telGebruik } from '@/lib/gebruikTellers'

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
{"tonen": true, "state": "groeikans", "bouwsteen": "sparsessies"}
of
{"tonen": false}

"tonen": false als het gebruikspatroon, gegeven de rol, al goed en volledig is en er niets zinvols aan te bevelen valt.
"state": "groeikans" bij een duidelijke, nog onbenutte bouwsteen. "neutraal" bij pril gebruik zonder duidelijk patroon. "gezond" bij overwegend goed gebruik met één relatief zwakkere bouwsteen.
"bouwsteen": alleen sparsessies, analyses of coaching, nooit gesprekken.`

/**
 * Herberekent de groeibalans-classificatie voor deze gebruiker en schrijft het resultaat weg
 * op approved_users. `activiteit` is een korte beschrijving van wat er zojuist is afgerond
 * (de gesprekstekst, of een samenvatting van de sparsessie), die als context meegaat.
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
  const [profielRes, tellers] = await Promise.all([
    supabase.from('arnobot_blog_profiles').select('profiel').eq('user_id', userId).single(),
    telGebruik(supabase, userId),
  ])
  const profiel = (profielRes.data?.profiel ?? {}) as Record<string, unknown>

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: GROEIBALANS_SYSTEM,
    messages: [{
      role: 'user',
      content: `Rol: ${profiel.rol ?? 'onbekend'}. Functiejaren: ${profiel.jaren_functie ?? 'onbekend'}. Teamgrootte: ${profiel.teamgrootte ?? 'onbekend'}.

Huidig gebruik in totaal: ${tellers.gesprekken} gesprekken, ${tellers.sparsessies} sparsessies, ${tellers.analyses} analyses, ${tellers.coaching} coachings.

${activiteit}`,
    }],
  })

  const classificatie = parseGroeibalansClassificatie(getText(res.content, '{}'))
  if (!classificatie) return

  const bijgewerkt = new Date().toISOString()
  const update = classificatie.tonen
    ? { groeibalans_tonen: true, groeibalans_state: classificatie.state, groeibalans_bouwsteen: classificatie.bouwsteen, groeibalans_bijgewerkt_op: bijgewerkt }
    : { groeibalans_tonen: false, groeibalans_state: null, groeibalans_bouwsteen: null, groeibalans_bijgewerkt_op: bijgewerkt }
  await supabase.from('approved_users').update(update).eq('user_id', userId)
}
