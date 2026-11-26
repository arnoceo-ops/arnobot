import { createClient } from '@supabase/supabase-js'
import { klantBestaat, maakKlant } from '@/lib/billing/mollie'
import { valideerZakelijk, type ZakelijkeGegevens } from '@/lib/billing/zakelijk'
import { berekenReguliereBedrag, huidigSeats, maakTeamFactuur, type TeamRow } from '@/lib/billing/teamFacturatie'
import { voegMaandenToe } from '@/lib/billing/perioden'
import { TEAM_MIN_GEBRUIKERS, type Cyclus } from '@/lib/teamPricing'
import { isAgentProef, proefEinde, proefStand, toegangTot, type ProefStaat } from '@/lib/teamProef'
import { TEST_PROEF_TEAM_ID } from '@/lib/internalTestAccounts'
import { logAdminActie } from '@/lib/adminLog'
import { notifyTelegram } from '@/lib/cron-notify'
import { VEILIG_TERUGSTORTEN, voordeelGebruikt } from '@/lib/billing/referralSignalen'

// Zelf een teamproef omzetten naar een betaald Team (docs/TEAM_PROCES.md, "Zelf activeren").
// Alleen voor een manager van een agent-proef (isAgentProef). Het doet hetzelfde als stap 7 van de
// handmatige route op /bot/admin/teams (min. seats, cyclus, factuurdatum, bedrijfsgegevens), plus de
// eerste factuur direct. De betaling loopt via de bestaande factuur, betaallink en webhook.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const MAX_SEATS = 500

export type ActivatieInvoer = { seats: number; cyclus: Cyclus; zakelijk: ZakelijkeGegevens }

/** Controleert en schoont de invoer van de manager. Zakelijke gegevens volgen exact dezelfde regels als afrekenen (valideerZakelijk). */
export async function valideerActivatie(raw: Record<string, unknown> | null | undefined): Promise<{ ok: true; waarde: ActivatieInvoer } | { ok: false; fout: string }> {
  const r = raw ?? {}
  const seats = Number(r.seats)
  if (!Number.isInteger(seats) || seats < TEAM_MIN_GEBRUIKERS) return { ok: false, fout: `Kies minimaal ${TEAM_MIN_GEBRUIKERS} gebruikers` }
  if (seats > MAX_SEATS) return { ok: false, fout: `Voor meer dan ${MAX_SEATS} gebruikers nemen we contact met je op` }
  if (r.cyclus !== 'maandelijks' && r.cyclus !== 'jaarlijks') return { ok: false, fout: 'Kies maandelijks of jaarlijks' }
  const zakelijk = await valideerZakelijk({ bedrijfsnaam: r.bedrijfsnaam, kvk: r.kvkNummer, btwNummer: r.btwNummer, straat: r.straat, postcode: r.postcode, plaats: r.plaats })
  if (!zakelijk.ok) return zakelijk
  return { ok: true, waarde: { seats, cyclus: r.cyclus, zakelijk: zakelijk.gegevens } }
}

/** Bedrag van de eerste factuur voor het voorbeeld in het scherm. Zelfde berekening als de facturatie. */
export function activatieBedrag(seats: number, cyclus: Cyclus) {
  return berekenReguliereBedrag(seats, cyclus)
}

export type ActivatieStand = {
  teamId: string
  teamNaam: string
  ledenAantal: number
  /** Facturatie staat al aan (min. seats gevuld): geen proef meer. */
  geactiveerd: boolean
  geblokkeerd: boolean
  /** De manager mag zelf activeren (agent-proef, nog geen facturatie). */
  kanActiveren: boolean
  /** einde: einde van de gratis proef. toegangTot: einde plus coulance. dagen: tot einde (loopt, bijna) of tot toegangTot (coulance). */
  proef: { einde: string; toegangTot: string; dagen: number; staat: ProefStaat } | null
  /** Openstaande teamfactuur, voor een geactiveerd team dat nog moet betalen. */
  openFactuur: { bedragCent: number; betaalLink: string | null; status: string } | null
  voorinvulling: { bedrijfsnaam: string; kvkNummer: string; btwNummer: string; straat: string; postcode: string; plaats: string } | null
  minSeats: number | null
  cyclus: Cyclus | null
}

/** De teamstand van een manager, of null als deze gebruiker geen team beheert. */
export async function leesActivatieStand(userId: string): Promise<ActivatieStand | null> {
  // Via het lidmaatschap, net als /api/bot/team/status: een account hoort bij één team. Zoeken op manager_id kan twee
  // teams opleveren (het testaccount is manager van Team Apex en van het testproefteam) en dan komt er niets terug.
  const { data: lid } = await supabase.from('arnobot_team_members').select('team_id').eq('user_id', userId).eq('role', 'manager').maybeSingle<{ team_id: string }>()
  if (!lid) return null
  const { data: team } = await supabase
    .from('arnobot_teams')
    .select('id, name, min_seats, cyclus, geblokkeerd_at')
    .eq('id', lid.team_id)
    .maybeSingle<{ id: string; name: string; min_seats: number | null; cyclus: Cyclus | null; geblokkeerd_at: string | null }>()
  if (!team) return null

  const [{ data: manager }, { count }, { data: facturen }, { data: klant }] = await Promise.all([
    supabase.from('approved_users').select('trial_start, expires_at, paid_at, sd_attribution_method').eq('user_id', userId)
      .maybeSingle<{ trial_start: string | null; expires_at: string | null; paid_at: string | null; sd_attribution_method: string | null }>(),
    supabase.from('arnobot_team_members').select('*', { count: 'exact', head: true }).eq('team_id', team.id),
    supabase.from('arnobot_team_facturen').select('bedrag_cent, status, mollie_payment_link_url').eq('team_id', team.id).in('status', ['open', 'overdue']).order('created_at', { ascending: false }).limit(1)
      .returns<{ bedrag_cent: number; status: string; mollie_payment_link_url: string | null }[]>(),
    supabase.from('arnobot_billing_customers').select('bedrijfsnaam, kvk_nummer, btw_nummer, straat, postcode, plaats').eq('user_id', userId)
      .maybeSingle<{ bedrijfsnaam: string | null; kvk_nummer: string | null; btw_nummer: string | null; straat: string | null; postcode: string | null; plaats: string | null }>(),
  ])

  const kanActiveren = !!manager && isAgentProef(manager, team.min_seats)
  const einde = manager && kanActiveren ? proefEinde(manager) : null
  const stand = einde ? proefStand(einde) : null
  const open = facturen?.[0]

  return {
    teamId: team.id,
    teamNaam: team.name,
    ledenAantal: count ?? 0,
    geactiveerd: team.min_seats !== null,
    geblokkeerd: !!team.geblokkeerd_at,
    kanActiveren,
    proef: einde && stand ? { einde: einde.toISOString(), toegangTot: toegangTot(einde).toISOString(), dagen: stand.dagen, staat: stand.staat } : null,
    openFactuur: team.min_seats !== null && open ? { bedragCent: open.bedrag_cent, betaalLink: open.mollie_payment_link_url, status: open.status } : null,
    voorinvulling: klant
      ? { bedrijfsnaam: klant.bedrijfsnaam ?? '', kvkNummer: klant.kvk_nummer ?? '', btwNummer: klant.btw_nummer ?? '', straat: klant.straat ?? '', postcode: klant.postcode ?? '', plaats: klant.plaats ?? '' }
      : null,
    minSeats: team.min_seats,
    cyclus: team.cyclus,
  }
}

/**
 * De referral fee voor een aangebracht team wordt nog niet automatisch verrekend: dan moet Arno het weten. Een fout hier
 * houdt het activeren niet tegen.
 */
async function meldAangebrachtTeam(managerId: string, teamNaam: string): Promise<void> {
  const { data, error } = await supabase.from('arnobot_referrals').select('code_used, referred_discount').eq('referred_user_id', managerId)
    .maybeSingle<{ code_used: string | null; referred_discount: number | null }>()
  if (error) {
    await notifyTelegram(`Niet te controleren of een geactiveerd team is aangebracht (arno.bot)\n\nTeam: ${teamNaam}\nZoek zelf in Admin, Referrals.`)
    return
  }
  // Het voordeel is eenmalig: wie al een referral fee op een eigen jaarabonnement kreeg, krijgt geen teammaand.
  if (!data || voordeelGebruikt(data)) return
  await notifyTelegram(`ACTIE: aangebracht team op arno.bot\n\nTeam: ${teamNaam} (referralcode ${data.code_used ?? 'onbekend'})\nHet team heeft eenmalig recht op een maand voor het hele team, hooguit de maandprijs bij de start, als het op tijd betaalt (teamproef plus 10 dagen). Dit is NIET op de factuur verrekend. ${VEILIG_TERUGSTORTEN}`)
}

export type ActivatieUitkomst =
  | { ok: true; bedragCent: number; seats: number; betaalLink: string | null }
  | { ok: false; status: number; fout: string }

/**
 * Activeert het team: bedrijfsgegevens, facturatie-instellingen, deblokkeren en de eerste factuur.
 * Deblokkeren gebeurt direct: de factuur heeft een betaaltermijn van 14 dagen en bij niet betalen
 * blokkeert de facturatie-cron na 30 dagen over de vervaldatum, net als bij elk ander team.
 * Het team wordt atomair geclaimd (min_seats moet nog leeg zijn), dus een dubbele klik maakt één factuur.
 */
export async function activeerTeam(userId: string, invoer: ActivatieInvoer): Promise<ActivatieUitkomst> {
  const stand = await leesActivatieStand(userId)
  if (!stand) return { ok: false, status: 404, fout: 'Je beheert geen team' }
  if (!stand.kanActiveren) return { ok: false, status: 409, fout: stand.geactiveerd ? 'Dit team is al geactiveerd' : 'Dit team kan niet zelf geactiveerd worden, neem contact met ons op' }

  // Een blokkade die Arno zelf zette heft de manager niet op door te activeren.
  const { data: blok, error: blokFout } = await supabase.from('arnobot_teams').select('geblokkeerd_at, geblokkeerd_handmatig').eq('id', stand.teamId)
    .maybeSingle<{ geblokkeerd_at: string | null; geblokkeerd_handmatig: boolean | null }>()
  if (blokFout) return { ok: false, status: 500, fout: 'Team activeren mislukt' }
  if (blok?.geblokkeerd_at && blok.geblokkeerd_handmatig) {
    await notifyTelegram(`Manager probeert een team te activeren dat je zelf hebt geblokkeerd (arno.bot)\n\nTeam: ${stand.teamNaam}\nEr is niets gewijzigd. Wil je dit team toelaten, hef dan de blokkade op bij Admin, Teams.`)
    return { ok: false, status: 409, fout: 'Dit team kan niet zelf geactiveerd worden, neem contact met ons op' }
  }

  const { data: gebruiker } = await supabase.from('approved_users').select('email').eq('user_id', userId).maybeSingle<{ email: string | null }>()
  const { data: bestaand } = await supabase.from('arnobot_billing_customers').select('mollie_customer_id').eq('user_id', userId).maybeSingle<{ mollie_customer_id: string }>()
  const z = invoer.zakelijk
  // Een bewaarde klant kan bij Mollie ontbreken (test en live door elkaar): dan een nieuwe aanmaken, zoals bij afrekenen.
  const bewaard = bestaand?.mollie_customer_id ?? null
  const bewaardBestaat = bewaard ? await klantBestaat(bewaard) : false
  if (!bewaardBestaat && !gebruiker?.email) return { ok: false, status: 400, fout: 'Geen e-mailadres bekend voor dit account' }
  const mollieKlantId = bewaard && bewaardBestaat ? bewaard : (await maakKlant({ naam: z.bedrijfsnaam, email: gebruiker!.email!, userId, vervangt: bewaard ?? undefined })).id

  const { error: klantFout } = await supabase.from('arnobot_billing_customers').upsert(
    {
      user_id: userId,
      mollie_customer_id: mollieKlantId,
      klant_type: 'zakelijk',
      bedrijfsnaam: z.bedrijfsnaam,
      kvk_nummer: z.kvk,
      btw_nummer: z.btw,
      btw_gevalideerd: z.btwGevalideerd,
      straat: z.straat,
      postcode: z.postcode,
      plaats: z.plaats,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (klantFout) return { ok: false, status: 500, fout: 'Bedrijfsgegevens opslaan mislukt' }

  // Vóór de claim: mislukt het tellen, dan is er nog niets geactiveerd.
  let seats: number
  try {
    seats = await huidigSeats(stand.teamId, invoer.seats)
  } catch {
    return { ok: false, status: 500, fout: 'Team activeren mislukt' }
  }

  const nu = new Date()
  const vandaag = nu.toISOString().slice(0, 10)
  const { data: geclaimd, error: claimFout } = await supabase
    .from('arnobot_teams')
    .update({ min_seats: invoer.seats, cyclus: invoer.cyclus, volgende_factuurdatum: vandaag, geblokkeerd_at: null, geblokkeerd_handmatig: false })
    .eq('id', stand.teamId)
    .is('min_seats', null)
    // Ook hier: een eigen blokkade die tijdens het activeren is gezet blijft staan.
    .eq('geblokkeerd_handmatig', false)
    .select('id, name, manager_id, min_seats, cyclus, volgende_factuurdatum, geblokkeerd_at')
    .returns<TeamRow[]>()
  if (claimFout) return { ok: false, status: 500, fout: 'Team activeren mislukt' }
  const team = geclaimd?.[0]
  if (!team) return { ok: false, status: 409, fout: 'Dit team is al geactiveerd' }

  const { nettoCent, btwCent, brutoCent } = berekenReguliereBedrag(seats, invoer.cyclus)
  const periodeEinde = voegMaandenToe(nu, invoer.cyclus === 'jaarlijks' ? 12 : 1)
  const gemaakt = await maakTeamFactuur(team, {
    soort: 'regulier', periodeStart: nu, periodeEinde, seats, nettoCent, btwCent,
    zonderBoekhouding: team.id === TEST_PROEF_TEAM_ID,
  })

  await meldAangebrachtTeam(userId, team.name)

  await logAdminActie({
    actie: 'team_geactiveerd', doelUserId: userId, doelTeamId: team.id,
    // Kort gehouden voor het logboek op Status: cyclus, aantal gebruikers en bedrijf (het bedrag staat in Telegram en op de factuur).
    details: { nieuw: { cyclus: invoer.cyclus, gebruikers: invoer.seats, bedrijf: z.bedrijfsnaam } },
  })
  await notifyTelegram(`Team geactiveerd door de manager zelf op arno.bot\n\nTeam: ${team.name}\nBedrijf: ${z.bedrijfsnaam}\nSeats: ${seats} (${invoer.cyclus})\nBedrag incl. btw: €${(brutoCent / 100).toFixed(2)}\n${gemaakt.ok ? 'De factuur en betaallink zijn verstuurd.' : 'LET OP: de factuur is NIET goed aangemaakt of verstuurd. Zie de melding hierboven en rond hem met de hand af.'}`)
  // Het team is al geactiveerd; zonder factuur geen succesmelding aan de manager.
  if (!gemaakt.ok) return { ok: false, status: 500, fout: 'Je team is actief, maar de factuur is niet gelukt. We sturen hem je na.' }

  const { data: factuur } = await supabase
    .from('arnobot_team_facturen').select('mollie_payment_link_url').eq('team_id', team.id).order('created_at', { ascending: false }).limit(1)
    .returns<{ mollie_payment_link_url: string | null }[]>()
  return { ok: true, bedragCent: brutoCent, seats, betaalLink: factuur?.[0]?.mollie_payment_link_url ?? null }
}

/** Teamlid (geen manager) van een geblokkeerd team, of null. Voor /bot/doorgaan: een lid kan zelf niets afrekenen. */
export async function leesLidVanGeblokkeerdTeam(userId: string): Promise<{ teamNaam: string } | null> {
  const { data } = await supabase
    .from('arnobot_team_members')
    .select('role, arnobot_teams(name, geblokkeerd_at)')
    .eq('user_id', userId)
    .maybeSingle<{ role: string; arnobot_teams: { name: string; geblokkeerd_at: string | null } | { name: string; geblokkeerd_at: string | null }[] | null }>()
  if (!data || data.role === 'manager') return null
  const team = Array.isArray(data.arnobot_teams) ? data.arnobot_teams[0] : data.arnobot_teams
  return team?.geblokkeerd_at ? { teamNaam: team.name } : null
}
