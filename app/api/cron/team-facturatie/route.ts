import { NextRequest, NextResponse } from 'next/server'
import { billingDb } from '@/lib/billing/db'
import { mollieIngeschakeld } from '@/lib/billing/mollie'
import { voegMaandenToe } from '@/lib/billing/perioden'
import {
  berekenReguliereBedrag,
  berekenTussentijdsBedrag,
  huidigSeats,
  maakTeamFactuur,
  type TeamFactuurRow,
  type TeamRow,
} from '@/lib/billing/teamFacturatie'
import { verstuurTeamMail } from '@/lib/billing/teamMails'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'

const DAG_MS = 24 * 60 * 60 * 1000
const BETAALTERMIJN_DAGEN = 14
const BLOKKADE_NA_DAGEN = 30 // vanaf de vervaldatum, dus 44 dagen na de factuurdatum

const dagVan = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
const dagenSinds = (iso: string, nu: Date) => Math.floor((dagVan(nu).getTime() - dagVan(new Date(iso)).getTime()) / DAG_MS)

// Dagelijkse Team-facturatieronde (fase 2b, zie docs/MOLLIE_PLAN.md):
//  1. reguliere cyclusfactuur zodra volgende_factuurdatum is bereikt
//  2. eenmalige naar-rato tussenfactuur bij een jaarlijks team dat seats heeft toegevoegd
//  3. herinnering 7 dagen na de vervaldatum (betaaltermijn 14 dagen) van een onbetaalde factuur
//  4. blokkade 30 dagen na de vervaldatum van een nog altijd onbetaalde factuur
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!mollieIngeschakeld()) return NextResponse.json({ ok: true, overgeslagen: 'mollie niet ingeschakeld' })

  const samenvatting = { reguliereFacturen: 0, tussentijdseFacturen: 0, herinneringen: 0, blokkades: 0, fouten: 0 }
  try {
    const nu = new Date()
    const vandaag = dagVan(nu).toISOString().slice(0, 10)

    // Alleen teams die zijn "geactiveerd" voor automatische facturatie (zie /bot/admin/teams).
    const { data: teamsRaw } = await billingDb
      .from('arnobot_teams')
      .select('id, name, manager_id, min_seats, cyclus, volgende_factuurdatum, geblokkeerd_at')
      .not('min_seats', 'is', null)
      .not('cyclus', 'is', null)
      .not('volgende_factuurdatum', 'is', null)
      .returns<TeamRow[]>()
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
          await maakTeamFactuur(team, { soort: 'regulier', periodeStart, periodeEinde, seats, nettoCent, btwCent })
          samenvatting.reguliereFacturen++
        } else if (team.cyclus === 'jaarlijks') {
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
              await maakTeamFactuur(team, { soort: 'tussentijds', periodeStart: nu, periodeEinde, seats, nettoCent, btwCent })
              samenvatting.tussentijdseFacturen++
            }
          }
        }

        // 3 + 4. Herinnering en blokkade op openstaande facturen van dit team.
        const { data: openFacturen } = await billingDb
          .from('arnobot_team_facturen')
          .select('*')
          .eq('team_id', team.id)
          .eq('status', 'open')
          .returns<TeamFactuurRow[]>()
        for (const f of openFacturen ?? []) {
          const dagenOverTijd = dagenSinds(f.created_at, nu) - BETAALTERMIJN_DAGEN
          if (dagenOverTijd >= BLOKKADE_NA_DAGEN && !team.geblokkeerd_at) {
            await billingDb.from('arnobot_teams').update({ geblokkeerd_at: nu.toISOString() }).eq('id', team.id)
            await verstuurTeamMail(team.manager_id, 'team_geblokkeerd', {
              teamNaam: team.name, bedragCent: f.bedrag_cent, seats: f.seats_aantal, betaalLink: f.mollie_payment_link_url ?? undefined,
            })
            await notifyTelegram(`Team geblokkeerd wegens onbetaalde factuur op arno.bot\n\nTeam: ${team.name}\nFactuur: ${f.id}`)
            samenvatting.blokkades++
          } else if (dagenOverTijd >= 7 && !f.herinnering_at) {
            const { data: geclaimd } = await billingDb
              .from('arnobot_team_facturen')
              .update({ herinnering_at: nu.toISOString() })
              .eq('id', f.id)
              .is('herinnering_at', null)
              .select('id')
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
        console.error('[cron/team-facturatie] team', team.id, e instanceof Error ? e.message : e)
      }
    }

    return NextResponse.json({ ok: true, ...samenvatting })
  } catch (e) {
    await notifyCronFailure('team-facturatie', e)
    return NextResponse.json({ error: 'Team-facturatie-cron mislukt' }, { status: 500 })
  }
}
