import { createClient } from '@supabase/supabase-js'
import { opzeggingIngaat } from '@/lib/billing/perioden'
import { notifyTelegram } from '@/lib/cron-notify'
import { logAdminActie } from '@/lib/adminLog'
import { TEST_TEAM_IDS_IN } from '@/lib/internalTestAccounts'

// Een teammanager zegt het teamabonnement op (docs/TEAM_PROCES.md, fase 6). Dezelfde regel als bij zakelijke Basic en Pro,
// artikel 7 van de voorwaarden: opzegtermijn van één maand vóór het einde van de lopende betaalperiode, anders loopt het
// team nog een periode door. De einddatum komt in arnobot_teams.stopt_op (docs/sql/2026-11-15-team-stopt-op.sql). Tot die
// dag houden manager en leden toegang. Op die dag blokkeert het team en stopt de facturatie (de cron team-facturatie).
// Dit is meteen het opheffen van een team: er is geen losse verwijderfunctie, team en leden blijven in de database staan.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const DAG = 86_400_000
const dagTekst = (d: Date) => d.toISOString().slice(0, 10)
const alsDatum = (jjjjmmdd: string) => new Date(`${jjjjmmdd}T00:00:00.000Z`)

type TeamRij = {
  id: string
  name: string
  manager_id: string
  min_seats: number | null
  cyclus: 'maandelijks' | 'jaarlijks' | null
  volgende_factuurdatum: string | null
  geblokkeerd_at: string | null
  stopt_op: string | null
}
const KOLOMMEN = 'id, name, manager_id, min_seats, cyclus, volgende_factuurdatum, geblokkeerd_at, stopt_op'

/**
 * Wanneer stopt het team als de manager nu opzegt? Het einde van de lopende periode (de volgende factuurdatum) als de
 * opzegging uiterlijk een maand ervoor komt, anders een periode later. null als het team geen facturatie heeft (een team
 * dat jij handmatig beheert): dan is er geen automatische einddatum en blijft het bij een melding aan jou.
 * Nooit vóór morgen: een einddatum in het verleden zou de cron meteen laten stoppen zonder dat iemand het kon zien.
 */
export function berekenTeamStop(
  team: Pick<TeamRij, 'min_seats' | 'cyclus' | 'volgende_factuurdatum'>,
  nu: Date,
): Date | null {
  if (team.min_seats === null || !team.cyclus || !team.volgende_factuurdatum) return null
  // De einddatum telt tot het einde van die dag: opzeggen precies een maand ervoor is nog op tijd.
  const periodeEinde = new Date(`${team.volgende_factuurdatum}T23:59:59.999Z`)
  const ingaat = opzeggingIngaat(nu, periodeEinde, team.cyclus, 'zakelijk')
  const morgen = alsDatum(dagTekst(new Date(nu.getTime() + DAG)))
  return ingaat.getTime() < morgen.getTime() ? morgen : alsDatum(dagTekst(ingaat))
}

async function teamVanManager(userId: string): Promise<TeamRij | null> {
  const { data: lid } = await supabase.from('arnobot_team_members').select('team_id').eq('user_id', userId).eq('role', 'manager').maybeSingle<{ team_id: string }>()
  if (!lid) return null
  const { data: team } = await supabase.from('arnobot_teams').select(KOLOMMEN).eq('id', lid.team_id).maybeSingle<TeamRij>()
  return team ?? null
}

export type TeamOpzegUitkomst =
  | { ok: true; teamNaam: string; stoptOp: string | null }
  | { ok: false; status: number; fout: string }

/** Zet de einddatum van het team van deze manager. stoptOp is null bij een team zonder facturatie (alleen een melding aan Arno). */
export async function zegTeamOp(userId: string, nu: Date = new Date()): Promise<TeamOpzegUitkomst> {
  const team = await teamVanManager(userId)
  if (!team) return { ok: false, status: 404, fout: 'Je beheert geen team' }
  if (team.stopt_op) return { ok: false, status: 409, fout: 'Dit team is al opgezegd' }
  const stop = berekenTeamStop(team, nu)
  if (!stop) return { ok: true, teamNaam: team.name, stoptOp: null }

  const stoptOp = dagTekst(stop)
  const { data, error } = await supabase.from('arnobot_teams').update({ stopt_op: stoptOp }).eq('id', team.id).is('stopt_op', null).select('id')
  if (error) return { ok: false, status: 500, fout: 'Opzeggen is niet gelukt, probeer het zo opnieuw' }
  if (!data?.length) return { ok: false, status: 409, fout: 'Dit team is al opgezegd' }
  await logAdminActie({ actie: 'team_opgezegd', doelUserId: userId, doelTeamId: team.id, details: { nieuw: { stopt_op: stoptOp } } })
  return { ok: true, teamNaam: team.name, stoptOp }
}

/** Trekt een opzegging in, tot en met de dag vóór de einddatum. Op de einddatum zelf en daarna niet meer. */
export async function trekTeamOpzeggingIn(userId: string, nu: Date = new Date()): Promise<{ ok: true } | { ok: false; status: number; fout: string }> {
  const team = await teamVanManager(userId)
  if (!team) return { ok: false, status: 404, fout: 'Je beheert geen team' }
  if (!team.stopt_op) return { ok: false, status: 409, fout: 'Dit team is niet opgezegd' }
  if (dagTekst(nu) >= team.stopt_op) return { ok: false, status: 409, fout: 'De einddatum is bereikt, intrekken kan niet meer' }

  const { data, error } = await supabase.from('arnobot_teams').update({ stopt_op: null }).eq('id', team.id).eq('stopt_op', team.stopt_op).select('id')
  if (error || !data?.length) return { ok: false, status: 500, fout: 'Intrekken is niet gelukt, probeer het zo opnieuw' }
  await supabase.from('approved_users').update({ cancelled_at: null }).eq('user_id', userId)
  await logAdminActie({ actie: 'team_opzegging_ingetrokken', doelUserId: userId, doelTeamId: team.id, details: { oud: { stopt_op: team.stopt_op } } })
  await notifyTelegram(`Teamopzegging ingetrokken op arno.bot\n\nTeam: ${team.name}\nDe manager heeft de opzegging ingetrokken. Het team loopt door en de facturatie ook.`)
  return { ok: true }
}

/**
 * Stopt de opgezegde teams waarvan de einddatum is bereikt: blokkeren en de facturatie uitzetten (geen volgende
 * factuurdatum meer). Idempotent: een team dat al gestopt is wordt overgeslagen. Aangeroepen door de cron team-facturatie.
 * Geeft de namen van de teams die nu zijn gestopt.
 */
export async function stopOpgezegdeTeams(vandaag: string, nu: Date = new Date()): Promise<string[]> {
  const { data: teams, error: teamsFout } = await supabase
    .from('arnobot_teams')
    .select(KOLOMMEN)
    .not('stopt_op', 'is', null)
    .lte('stopt_op', vandaag)
    .not('id', 'in', TEST_TEAM_IDS_IN)
    .returns<TeamRij[]>()
  // Stil doorgaan zou een opgezegd team nog een factuur geven.
  if (teamsFout) throw new Error(`opgezegde teams ophalen mislukt: ${teamsFout.message}`)
  const gestopt: string[] = []
  for (const team of teams ?? []) {
    if (team.geblokkeerd_at && !team.volgende_factuurdatum) continue // al gestopt
    const { error } = await supabase.from('arnobot_teams')
      // Een blokkade die er al stond houdt zijn kenmerk; een nieuwe is niet van jou.
      .update({ geblokkeerd_at: team.geblokkeerd_at ?? nu.toISOString(), volgende_factuurdatum: null, ...(team.geblokkeerd_at ? {} : { geblokkeerd_handmatig: false }) })
      .eq('id', team.id)
    if (error) throw new Error(`team stoppen mislukt: ${error.message}`)
    await logAdminActie({ actie: 'team_gestopt', doelUserId: team.manager_id, doelTeamId: team.id, details: { nieuw: { stopt_op: team.stopt_op } } })
    await notifyTelegram(`Team gestopt na opzegging op arno.bot\n\nTeam: ${team.name}\nEinddatum: ${team.stopt_op}\nDe toegang van manager en leden is geblokkeerd en de facturatie is gestopt. Team en leden blijven in de database staan.`)
    gestopt.push(team.name)
  }
  return gestopt
}

/** Zo veel dagen na de factuurdatum blokkeert de facturatiecron (14 dagen betaaltermijn plus 30 dagen). */
export const BLOKKADE_NA_FACTUUR_DAGEN = 44

async function meldBlokkadeBlijft(teamId: string, reden: string): Promise<false> {
  await notifyTelegram(`Teamfactuur betaald, maar de blokkade blijft staan (arno.bot)\n\nTeam: ${teamId}\nReden: ${reden}\nHef de blokkade zelf op via Admin, Teams, als dat niet klopt.`)
  return false
}

/**
 * Heft de blokkade van een team op na een betaling. Niet als het team is gestopt (een late betaling zet een opgezegd team
 * niet weer open), niet als Arno zelf heeft geblokkeerd en niet zolang een andere factuur ver genoeg over tijd openstaat.
 * Bij een databasefout blijft de blokkade staan en volgt een melding. Geeft true als de blokkade is opgeheven.
 */
export async function ontblokkeerNaBetaling(teamId: string, vandaag: string): Promise<boolean> {
  // Alle kolommen: geblokkeerd_handmatig bestaat pas na docs/sql/2026-11-26-team-blokkade-handmatig.sql.
  const { data, error } = await supabase.from('arnobot_teams').select('*').eq('id', teamId)
    .maybeSingle<{ stopt_op: string | null; geblokkeerd_at: string | null; geblokkeerd_handmatig?: boolean | null }>()
  if (error) return meldBlokkadeBlijft(teamId, `het team is niet op te zoeken (${error.message})`)
  if (data?.stopt_op && data.stopt_op <= vandaag) return false
  if (!data?.geblokkeerd_at) return true
  if (data.geblokkeerd_handmatig) return meldBlokkadeBlijft(teamId, 'je hebt dit team zelf geblokkeerd')

  const grens = new Date(Date.parse(`${vandaag}T00:00:00.000Z`) - (BLOKKADE_NA_FACTUUR_DAGEN - 1) * DAG).toISOString()
  const { data: teLaat, error: factuurFout } = await supabase.from('arnobot_team_facturen').select('*').eq('team_id', teamId).eq('status', 'open').lt('created_at', grens)
  if (factuurFout) return meldBlokkadeBlijft(teamId, `de open facturen zijn niet op te zoeken (${factuurFout.message})`)
  // Een factuur die de klant nooit heeft bereikt blokkeert niet, en houdt een blokkade dus ook niet vast. Zonder de
  // kolom (undefined) telt elke open factuur.
  if (teLaat?.some(f => f.bezorgd_at !== null)) return meldBlokkadeBlijft(teamId, 'er staat nog een andere factuur open die over de blokkadegrens is')

  // De voorwaarde dekt een eigen blokkade die tussen het lezen en dit schrijven is gezet.
  const { data: opgeheven, error: updateFout } = await supabase.from('arnobot_teams').update({ geblokkeerd_at: null }).eq('id', teamId).not('geblokkeerd_handmatig', 'is', true).select('id')
  if (updateFout) return meldBlokkadeBlijft(teamId, `opheffen mislukt (${updateFout.message})`)
  if (!opgeheven?.length) return meldBlokkadeBlijft(teamId, 'het team is intussen met de hand geblokkeerd')
  return true
}
