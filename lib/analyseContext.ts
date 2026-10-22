import { createClient } from '@supabase/supabase-js'
import { RULE_ENGLISH_TERMS, RULE_NO_CRUDE_LANGUAGE, RULE_NEVER_BREAK_CHARACTER, RULE_NO_INVENTED_DETAILS, RULE_NO_TIME_PRESSURE } from '@/lib/systemPrompt'

// Gedeelde bouwstenen voor de patroonanalyse: de handmatige route (coaching-analyse), de aanvulling
// daarop (coaching-analyse/aanvulling) en de dagelijkse auto-analyse. Alleen server-side importeren.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// De analyse ziet alleen titels en samenvattingen van gesprekken. Zonder deze regel trok het model
// conclusies over uitstelgedrag uit wat er niet in de chat staat (22 oktober 2026). Gespreksnummers
// zijn weg: gebruikers zien ze nergens en de nummering liep omgekeerd aan de tijd.
export const RULE_ANALYSE_BUITEN_CHAT = `Je ziet alleen wat de gebruiker in de gesprekken met ArnoBot heeft besproken, niet wat die persoon daarbuiten doet. Zeg daarom nooit dat de gebruiker iets niet uitvoert, uitstelt of laat liggen op basis van wat er niet in de gesprekken staat. Beschrijf alleen wat je in de gesprekken zelf ziet, bijvoorbeeld "in de gesprekken zie ik vooral" of "wat je buiten ArnoBot doet, zie ik niet". Noem gesprekken nooit bij nummer, alleen bij onderwerp.`

export const ANALYSE_SYSTEM_PROMPT = `Je bent Arno Diepeveen. Salesstrateeg, direct, ongefilterd. Spreek de gebruiker direct aan met "je". Geen bullet points. Geen inleiding. Geen accenten op woorden voor nadruk. Gebruik het woord "moeten" niet; gebruik alternatieven als "kun je", "wil je", "loont het om". Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.

${RULE_NO_TIME_PRESSURE}

${RULE_ENGLISH_TERMS}

${RULE_NO_CRUDE_LANGUAGE}

${RULE_NEVER_BREAK_CHARACTER}

${RULE_NO_INVENTED_DETAILS}

${RULE_ANALYSE_BUITEN_CHAT}`

export const CONTEXT_MAX_TEKENS = 1000

/** Vrije tekst van de gebruiker over wat er buiten ArnoBot is gedaan: getrimd, zonder
 *  stuurtekens en begrensd. Lege string = niets aangeleverd. */
export function schoonContext(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, CONTEXT_MAX_TEKENS)
}

/** Blok voor de prompt met wat de gebruiker zelf over het werk buiten ArnoBot vertelt. */
export function contextBlok(context: string): string {
  if (!context) return ''
  return `\n\nDOOR DE GEBRUIKER ZELF VERTELD OVER WAT BUITEN ARNOBOT GEBEURD IS (behandel dit als feit, spreek het niet tegen en beweer niets dat hiermee botst):\n"""\n${context}\n"""`
}

type SessieRegel = { title: string; summary?: string | null; created_at: string }

/** Gesprekken van oud naar nieuw, zonder nummers, met datum en onderwerp. */
export function sessiesAlsTekst(sessions: SessieRegel[]): string {
  return [...sessions]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(s => `Gesprek van ${new Date(s.created_at).toLocaleDateString('nl-NL')}: ${s.title}${s.summary ? `\nSamenvatting: ${s.summary}` : ''}`)
    .join('\n\n')
}

/** Wat de gebruiker zelf vertelde over eigen plannen (jaar, groei of goedkeuring, track record van
 *  eerdere plannen, of het plan bleef leven). Komt uit de `feiten` van sessies, waar sessie-einde
 *  zulke feiten met het voorvoegsel "Plan:" vastlegt. Lege string zonder planfeiten. Gefilterd op
 *  user_id. Gespreksinput, nooit een losse KPI of dashboardwaarde. */
export async function planHistorieBlok(userId: string): Promise<string> {
  const { data } = await supabase
    .from('arnobot_blog_sessions')
    .select('feiten')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('community_excluded', false)
    .not('feiten', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30)
  const regels: string[] = []
  for (const rij of data ?? []) {
    for (const lijn of String(rij.feiten).split('\n')) {
      const schoon = lijn.replace(/^[\s\-*•]+/, '').trim()
      if (/^plan\s*:/i.test(schoon) && !regels.includes(schoon)) regels.push(schoon)
    }
  }
  if (regels.length === 0) return ''
  return `\n\nPLANHISTORIE (door de gebruiker zelf verteld in gesprekken, meest recent eerst):\n${regels.slice(0, 8).map(r => `- ${r}`).join('\n')}\nGebruik dit alleen als het bij de analyse past, als feit en zonder oordeel. Staat er dat eerdere plannen niet gehaald zijn, dan mag je dat verbinden met wat je in de gesprekken ziet, nooit met aannames over wat de gebruiker buiten de gesprekken doet.`
}

/** Wat de gebruiker zelf bij sessiestart aangaf over de vorige actie (ja, deels, nee), als blok
 *  voor de prompt. Lege string zonder antwoorden. Gefilterd op user_id. */
export async function actieOpvolgingBlok(userId: string): Promise<string> {
  const { data } = await supabase
    .from('arnobot_blog_sessions')
    .select('actie_status')
    .eq('user_id', userId)
    .eq('community_excluded', false)
    .not('actie_status', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)
  const antwoorden = (data ?? []).map(r => r.actie_status as string)
  if (antwoorden.length === 0) return ''
  const ja = antwoorden.filter(s => s === 'ja').length
  const deels = antwoorden.filter(s => s === 'deels').length
  const nee = antwoorden.length - ja - deels
  return `\n\nACTIEOPVOLGING (door de gebruiker zelf aangegeven bij het begin van sessies): van de laatste ${antwoorden.length} beantwoorde acties staan er ${ja} op gedaan, ${deels} op ingepland en ${nee} op niet gedaan. Gebruik dit als feit. Staan er veel op gedaan, dan beweer je nooit dat de gebruiker uitstelt of niets uitvoert.`
}
