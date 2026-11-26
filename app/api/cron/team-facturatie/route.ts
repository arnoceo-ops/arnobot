import * as Sentry from '@sentry/nextjs'
import { registreerCronRun } from '@/lib/cronRun'
import { nieuwMelden } from '@/lib/capaciteit'
import { NextRequest, NextResponse } from 'next/server'
import { billingDb } from '@/lib/billing/db'
import { mollieIngeschakeld } from '@/lib/billing/mollie'
import { voegMaandenToe } from '@/lib/billing/perioden'
import {
  berekenReguliereBedrag,
  berekenTussentijdsBedrag,
  haalGemisteTeamBetalingenIn,
  huidigSeats,
  maakTeamFactuur,
  type TeamFactuurRow,
  type TeamRow,
} from '@/lib/billing/teamFacturatie'
import { verstuurTeamMail } from '@/lib/billing/teamMails'
import { controleerBetaaldeTeamFacturen } from '@/lib/billing/teamBetalingen'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { TEST_TEAM_IDS_IN } from '@/lib/internalTestAccounts'
import { stopOpgezegdeTeams } from '@/lib/teamOpzegging'

const DAG_MS = 24 * 60 * 60 * 1000
const BETAALTERMIJN_DAGEN = 14
const BLOKKADE_NA_DAGEN = 30 // vanaf de vervaldatum, dus 44 dagen na de factuurdatum

const dagVan = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
const dagenSinds = (iso: string, nu: Date) => Math.floor((dagVan(nu).getTime() - dagVan(new Date(iso)).getTime()) / DAG_MS)

// Dagelijkse Team-facturatieronde (fase 2b, zie docs/MOLLIE_PLAN.md):
//  0. gemiste webhooks inhalen: open facturen die bij Mollie al betaald zijn (vóór herinnering en blokkade)
//  1. reguliere cyclusfactuur zodra volgende_factuurdatum is bereikt
//  2. eenmalige naar-rato tussenfactuur bij een jaarlijks team dat seats heeft toegevoegd
//  3. herinnering 7 dagen na de vervaldatum (betaaltermijn 14 dagen) van een onbetaalde factuur
//  4. blokkade 30 dagen na de vervaldatum van een nog altijd onbetaalde factuur
//  5. nacontrole bij Mollie op terugbetalingen en terugboekingen van betaalde facturen
async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!mollieIngeschakeld()) return NextResponse.json({ ok: true, overgeslagen: 'mollie niet ingeschakeld' })

  const samenvatting = { reguliereFacturen: 0, tussentijdseFacturen: 0, herinneringen: 0, blokkades: 0, gestopt: 0, ingehaald: 0, terugdraaiingen: 0, fouten: 0 }
  try {
    const nu = new Date()
    const vandaag = dagVan(nu).toISOString().slice(0, 10)

    // Eerst de opgezegde teams waarvan de einddatum is bereikt: blokkeren en de facturatie uitzetten (docs/TEAM_PROCES.md, fase 6).
    // Daarna staat hun volgende factuurdatum leeg, dus de selectie hieronder slaat ze over en er komt geen factuur meer.
    samenvatting.gestopt = (await stopOpgezegdeTeams(vandaag, nu)).length

    const gemist = await haalGemisteTeamBetalingenIn()
    samenvatting.ingehaald = gemist.ingehaald
    samenvatting.fouten += gemist.fouten
    const onzeker = new Set([...gemist.nietGecontroleerd, ...gemist.afwijkend])
    if (gemist.afwijkend.length) {
      // Eens per week per factuur, niet elke dag dezelfde melding.
      const nieuw: string[] = []
      for (const id of gemist.afwijkend) if (await nieuwMelden(`teamfactuur:afwijkend:${id}`, 'waarschuwing')) nieuw.push(id)
      if (nieuw.length) await notifyTelegram(`Teambetaling met een afwijkend bedrag op arno.bot\n\nFactuur: ${nieuw.join(', ')}\nEr is niets verwerkt en er volgt geen herinnering of blokkade. Beoordeel in Mollie.`)
    }

    // Alleen teams die zijn "geactiveerd" voor automatische facturatie (zie /bot/admin/teams).
    const { data: teamsRaw, error: teamsFout } = await billingDb
      .from('arnobot_teams')
      .select('id, name, manager_id, min_seats, cyclus, volgende_factuurdatum, geblokkeerd_at, stopt_op')
      .not('min_seats', 'is', null)
      .not('cyclus', 'is', null)
      .not('volgende_factuurdatum', 'is', null)
      .not('id', 'in', TEST_TEAM_IDS_IN)
      .returns<TeamRow[]>()
    if (teamsFout) throw new Error(`teams ophalen mislukt: ${teamsFout.message}`)
    const teams = teamsRaw ?? []

    for (const team of teams) {
      try {
        const minSeats = team.min_seats ?? 3
        const seats = await huidigSeats(team.id, minSeats)

        // 1. Reguliere cyclusfactuur.
        if (team.volgende_factuurdatum && team.volgende_factuurdatum <= vandaag) {
          const periodeStart = new Date(team.volgende_factuurdatum)
          const periodeEinde = voegMaandenToe(periodeStart, team.cyclus === 'jaarlijks' ? 12 : 1)
          const { nettoCent, btwCent } = berekenReguliereBedrag(seats, team.cyclus!)
          const gemaakt = await maakTeamFactuur(team, { soort: 'regulier', periodeStart, periodeEinde, seats, nettoCent, btwCent })
          if (gemaakt.ok) samenvatting.reguliereFacturen++
        } else if (team.cyclus === 'jaarlijks' && !team.stopt_op) {
          // 2. Tussentijdse uitbreiding: alleen zinvol te vergelijken als er al een eerdere
          // factuur was (anders is er niets om tegen af te zetten, en komt de eerste factuur
          // hierboven vanzelf aan de beurt op volgende_factuurdatum).
          const { data: laatste } = await billingDb
            .from('arnobot_team_facturen')
            .select('seats_aantal, periode_einde')
            .eq('team_id', team.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle<Pick<TeamFactuurRow, 'seats_aantal' | 'periode_einde'>>()
          if (laatste && seats > laatste.seats_aantal && team.volgende_factuurdatum) {
            const periodeEinde = new Date(team.volgende_factuurdatum)
            const periodeStartVanJaar = voegMaandenToe(periodeEinde, -12)
            const totaalDagen = Math.round((periodeEinde.getTime() - periodeStartVanJaar.getTime()) / DAG_MS)
            const resterendeDagen = Math.max(0, Math.round((periodeEinde.getTime() - nu.getTime()) / DAG_MS))
            const extra = seats - laatste.seats_aantal
            const { nettoCent, btwCent } = berekenTussentijdsBedrag(extra, resterendeDagen, totaalDagen)
            if (nettoCent > 0) {
              const gemaakt = await maakTeamFactuur(team, { soort: 'tussentijds', periodeStart: nu, periodeEinde, seats, nettoCent, btwCent })
              if (gemaakt.ok) samenvatting.tussentijdseFacturen++
            }
          }
        }

        // 3 + 4. Herinnering en blokkade op openstaande facturen van dit team.
        const { data: openFacturen, error: openFout } = await billingDb
          .from('arnobot_team_facturen')
          .select('*')
          .eq('team_id', team.id)
          .eq('status', 'open')
          .returns<TeamFactuurRow[]>()
        if (openFout) throw new Error(`open facturen ophalen mislukt: ${openFout.message}`)
        for (const f of openFacturen ?? []) {
          // Niet bij Mollie kunnen controleren of er betaald is: dan niets, morgen opnieuw.
          if (onzeker.has(f.id)) continue
          const dagenOverTijd = dagenSinds(f.created_at, nu) - BETAALTERMIJN_DAGEN
          // Zonder betaallink kon de klant niet betalen, en zonder bezorging weet hij van niets: nooit herinneren of
          // blokkeren, wel melden (eens per week).
          if (!f.mollie_payment_link_url || !f.bezorgd_at) {
            if (dagenOverTijd >= 7 && (await nieuwMelden(`teamfactuur:niet-bezorgd:${f.id}`, 'waarschuwing'))) {
              await notifyTelegram(`Teamfactuur ${f.mollie_payment_link_url ? 'niet als bezorgd vastgelegd' : 'zonder betaallink'} op arno.bot\n\nTeam: ${team.name}\nFactuur: ${f.id}\nEr volgt geen herinnering of blokkade. Rond deze factuur met de hand af.`)
            }
            continue
          }
          if (dagenOverTijd >= BLOKKADE_NA_DAGEN && !team.geblokkeerd_at) {
            const { data: geblokkeerd, error: blokFout } = await billingDb
              .from('arnobot_teams')
              .update({ geblokkeerd_at: nu.toISOString(), geblokkeerd_handmatig: false })
              .eq('id', team.id)
              .is('geblokkeerd_at', null)
              .select('id')
            if (blokFout) throw new Error(`team blokkeren mislukt: ${blokFout.message}`)
            team.geblokkeerd_at = nu.toISOString()
            // Intussen al geblokkeerd (bijvoorbeeld door jou): geen mail.
            if ((geblokkeerd?.length ?? 0) !== 1) continue
            await verstuurTeamMail(team.manager_id, 'team_geblokkeerd', {
              teamNaam: team.name, bedragCent: f.bedrag_cent, seats: f.seats_aantal, betaalLink: f.mollie_payment_link_url ?? undefined,
            })
            await notifyTelegram(`Team geblokkeerd wegens onbetaalde factuur op arno.bot\n\nTeam: ${team.name}\nFactuur: ${f.id}`)
            samenvatting.blokkades++
          } else if (dagenOverTijd >= 7 && !f.herinnering_at) {
            const { data: geclaimd, error: herinnerFout } = await billingDb
              .from('arnobot_team_facturen')
              .update({ herinnering_at: nu.toISOString() })
              .eq('id', f.id)
              .is('herinnering_at', null)
              .select('id')
            if (herinnerFout) throw new Error(`herinnering vastleggen mislukt: ${herinnerFout.message}`)
            if ((geclaimd?.length ?? 0) === 1) {
              await verstuurTeamMail(team.manager_id, 'team_factuur_herinnering', {
                teamNaam: team.name, bedragCent: f.bedrag_cent, seats: f.seats_aantal, betaalLink: f.mollie_payment_link_url ?? undefined,
              })
              samenvatting.herinneringen++
            }
          }
        }
      } catch (e) {
        samenvatting.fouten++
        Sentry.captureException(e, { tags: { onderdeel: 'team-facturatie' }, extra: { teamId: team.id } })
        console.error('[cron/team-facturatie] team', team.id, e instanceof Error ? e.message : e)
      }
    }

    // 5. Ook voor teams die inmiddels niet meer gefactureerd worden, daarom los van de lus hierboven.
    const nacontrole = await controleerBetaaldeTeamFacturen(nu)
    samenvatting.terugdraaiingen = nacontrole.gewijzigd
    samenvatting.fouten += nacontrole.fouten
    // De run telt als gelukt, dus een deelfout moet apart gemeld worden.
    if (samenvatting.fouten > 0) {
      await notifyTelegram(`Team-facturatie met ${samenvatting.fouten} fout(en) op arno.bot\n\nNiet bij Mollie gecontroleerde open facturen: ${gemist.nietGecontroleerd.join(', ') || 'geen'}\nDaarvoor is geen herinnering of blokkade gedaan. Zie Sentry.`)
    }

    return NextResponse.json({ ok: true, ...samenvatting })
  } catch (e) {
    await notifyCronFailure('team-facturatie', e)
    return NextResponse.json({ error: 'Team-facturatie-cron mislukt' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/team-facturatie', cronHandler)
