import * as Sentry from '@sentry/nextjs'
import { billingDb, type PayRow } from './db'
import { haalAlleRijen } from '@/lib/haalAlleRijen'
import { zetGratisKenmerk } from '@/lib/referralKenmerken'

// Vangnet voor het uitzetten van het kenmerk gratis account (lib/gratisAccount.ts). De betaalpaden, de herstart en de
// knop BETAALD zetten het zelf uit, maar die schrijfactie mag nooit een betaling laten mislukken en wordt daar niet
// herhaald. Deze controle draait dagelijks vóór het grootboek: is er na het aanzetten betaald, herstart of op BETAALD
// gedrukt, dan gaat het kenmerk alsnog uit.

interface Gemarkeerd {
  user_id: string
  gratis_sinds: string
  trial_reactivated_at?: string | null
}

type Antwoord<T> = { data: T[] | null; error: { message: string } | null }

function rijen<T>(wat: string, r: Antwoord<T>): T[] {
  if (r.error) throw new Error(`${wat} ophalen mislukt: ${r.error.message}`)
  return r.data ?? []
}

async function isNaDitKenmerkBetaald(g: Gemarkeerd): Promise<boolean> {
  const sinds = Date.parse(g.gratis_sinds)
  const na = (moment: string | null | undefined) => !!moment && Date.parse(moment) > sinds
  if (na(g.trial_reactivated_at)) return true

  const betalingen = rijen<PayRow>('betalingen', await billingDb.from('arnobot_payments').select('*').eq('user_id', g.user_id).eq('status', 'paid').limit(1000))
  if (betalingen.some(b => na(b.betaald_at) && !b.terugbetaling_verwerkt_at && !(b.teruggeboekt_cent > 0))) return true

  const knop = rijen<{ created_at: string }>('adminlog', await billingDb.from('arnobot_admin_log').select('created_at').eq('doel_user_id', g.user_id).eq('actie', 'betaald_gezet').limit(1000))
  if (knop.some(r => na(r.created_at))) return true

  const teams = rijen<{ id: string }>('teams', await billingDb.from('arnobot_teams').select('id').eq('manager_id', g.user_id).limit(100))
  if (!teams.length) return false
  const facturen = rijen<{ betaald_at: string | null; reversed_at?: string | null }>('teamfacturen',
    await billingDb.from('arnobot_team_facturen').select('*').in('team_id', teams.map(t => t.id)).eq('status', 'paid').limit(1000))
  return facturen.some(f => na(f.betaald_at) && !f.reversed_at)
}

export async function herstelGratisKenmerken(): Promise<{ uitgezet: string[]; fouten: string[] }> {
  const uit = { uitgezet: [] as string[], fouten: [] as string[] }
  let gemarkeerd: Gemarkeerd[]
  try {
    gemarkeerd = await haalAlleRijen<Gemarkeerd>((van, tot) =>
      billingDb.from('approved_users').select('*').not('gratis_sinds', 'is', null).order('user_id', { ascending: true }).range(van, tot))
  } catch (e) {
    // Zonder de kolom is er niemand gemarkeerd.
    if (/gratis_sinds/.test(e instanceof Error ? e.message : String(e))) return uit
    throw e
  }
  for (const g of gemarkeerd) {
    try {
      if (!(await isNaDitKenmerkBetaald(g))) continue
      await zetGratisKenmerk(billingDb, g.user_id, false)
      uit.uitgezet.push(g.user_id)
    } catch (e) {
      uit.fouten.push(`gratis kenmerk ${g.user_id}: ${e instanceof Error ? e.message : String(e)}`)
      Sentry.captureException(e, { level: 'error', tags: { onderdeel: 'gratis-herstel' }, extra: { userId: g.user_id } })
    }
  }
  return uit
}
