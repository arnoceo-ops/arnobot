import * as Sentry from '@sentry/nextjs'
import { billingDb } from './db'
import { betaaldeTeamsVan, eigenBetalingStaat, type Betaling, type Dossier, type GrootboekRegel } from './referralGrootboek'
import { isTeruggedraaid, saldoVan } from './referralSaldo'
import { MEELOOP } from './referralStand'
import type { TeamFactuurRow } from './teamFacturatie'
import { haalAlleRijen } from '@/lib/haalAlleRijen'
import { isGratisAccount } from '@/lib/gratisAccount'
import { TEST_TEAM_IDS } from '@/lib/internalTestAccounts'

// De tellers BETALEND en TEGOED in het referralblok op de accountpagina. Ze rekenen met dezelfde gegevens als het
// grootboek. Niet met approved_users.referral_credit (met de hand bijgehouden) en niet alleen met status 'converted'
// (alleen Pro), want daarmee klopten ze niet. null: nu niet te berekenen, dan toont het blok die teller niet.

export interface ReferralCijfers {
  betalend: number | null
  /** Exclusief btw. */
  tegoedCent: number | null
}

/** Wat er van een aangebrachte klant nodig is om te weten of die betaald heeft. */
type Klant = Pick<Dossier, 'gebruiker' | 'betalingen' | 'teams' | 'facturen' | 'isGewoonTeamlid' | 'ooitMetDeHandBetaald'>

/** Heeft deze aangebrachte klant betaald, en staat die betaling nog? */
function heeftBetaald(d: Klant, geconverteerd: boolean): boolean {
  if (d.betalingen.some(eigenBetalingStaat) || betaaldeTeamsVan(d).length > 0) return true
  // Buiten Mollie om (met de hand op BETAALD). Is er online of per teamfactuur betaald en staat dat niet meer, dan
  // beslist dat. Een openstaande of mislukte betaling zegt niets. Een gewoon teamlid betaalt zelf niets.
  if (d.isGewoonTeamlid || isGratisAccount(d.gebruiker) || d.betalingen.some(b => b.status === 'paid')
    || d.facturen.some(f => f.status === 'paid' || f.status === 'refunded' || !!f.reversed_at)) return false
  return geconverteerd || (d.ooitMetDeHandBetaald && !!d.gebruiker.paid_at)
}

type Antwoord<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>
const alle = <T>(vraag: (van: number, tot: number) => unknown) => haalAlleRijen<T>((van, tot) => vraag(van, tot) as Antwoord<T>)

/** De aangebrachte klanten samen in een paar zoekvragen: de accountpagina wacht hierop. Verwijderde accounts vallen weg. */
async function laadKlanten(ids: string[]): Promise<Map<string, Klant>> {
  type Persoon = Klant['gebruiker'] & { user_id: string }
  const [personen, betalingen, leden, teams, handLog] = await Promise.all([
    alle<Persoon>((van, tot) => billingDb.from('approved_users').select('*').in('user_id', ids).order('user_id').range(van, tot)),
    alle<Betaling & { user_id: string }>((van, tot) => billingDb.from('arnobot_payments').select('*').in('user_id', ids).order('id').range(van, tot)),
    alle<{ user_id: string }>((van, tot) => billingDb.from('arnobot_team_members').select('user_id, team_id').in('user_id', ids).order('user_id').order('team_id').range(van, tot)),
    alle<Klant['teams'][number] & { manager_id: string }>((van, tot) => billingDb.from('arnobot_teams').select('id, manager_id').in('manager_id', ids).order('id').range(van, tot)),
    alle<{ doel_user_id: string }>((van, tot) => billingDb.from('arnobot_admin_log').select('doel_user_id').eq('actie', 'betaald_gezet').in('doel_user_id', ids).order('id').range(van, tot)),
  ])
  const eigenTeams = teams.filter(t => !(TEST_TEAM_IDS as readonly string[]).includes(t.id))
  const facturen = eigenTeams.length
    ? await alle<TeamFactuurRow>((van, tot) => billingDb.from('arnobot_team_facturen').select('*').in('team_id', eigenTeams.map(t => t.id)).order('id').range(van, tot))
    : []
  const klanten = new Map<string, Klant>()
  for (const g of personen) {
    // Anonimiseren bij een verwijderverzoek: de rij blijft staan, zonder naam en e-mailadres.
    if (!g.email && !g.voornaam) continue
    const eigen = eigenTeams.filter(t => t.manager_id === g.user_id)
    klanten.set(g.user_id, {
      gebruiker: g,
      betalingen: betalingen.filter(b => b.user_id === g.user_id),
      teams: eigen,
      facturen: facturen.filter(f => eigen.some(t => t.id === f.team_id)),
      isGewoonTeamlid: leden.some(l => l.user_id === g.user_id) && g.command_manager !== true,
      ooitMetDeHandBetaald: handLog.some(r => r.doel_user_id === g.user_id),
    })
  }
  return klanten
}

async function telBetalend(userId: string): Promise<number> {
  const rijen = await alle<{ referred_user_id: string; status: string }>((van, tot) =>
    billingDb.from('arnobot_referrals').select('referred_user_id, status').eq('referrer_user_id', userId).order('id').range(van, tot))
  let aantal = 0
  // Per honderd, anders wordt de zoekvraag te lang.
  for (let i = 0; i < rijen.length; i += 100) {
    const deel = rijen.slice(i, i + 100)
    const klanten = await laadKlanten(deel.map(r => r.referred_user_id))
    aantal += deel.filter(r => {
      const d = klanten.get(r.referred_user_id)
      return !!d && heeftBetaald(d, r.status === 'converted')
    }).length
  }
  return aantal
}

async function telTegoed(userId: string): Promise<number | null> {
  // Zolang het grootboek meeloopt staan de toekenningen in de meeloopregels.
  const regels = await alle<GrootboekRegel>((van, tot) =>
    billingDb.from('arnobot_referral_grootboek').select('*').eq('aanbrenger_user_id', userId).eq('meeloop', MEELOOP).order('created_at').order('id').range(van, tot))
  // Toegekend met een bedrag dat nog niet vaststaat: elk cijfer, ook nul, zou dan te laag zijn.
  const bedragOnbekend = regels.some(t => t.soort === 'toekenning' && t.netto_cent === null
    && !regels.some(r => (r.soort === 'vaststelling' || r.soort === 'verval') && (r.hoort_bij ?? r.referral_id) === t.referral_id)
    && !isTeruggedraaid(regels, t.referral_id))
  return bedragOnbekend ? null : saldoVan(regels).beschikbaarCent
}

const ofNiets = <T>(taak: Promise<T>) => taak.catch(e => {
  Sentry.captureException(e, { tags: { onderdeel: 'referral-cijfers' } })
  return null
})

export async function referralCijfers(userId: string): Promise<ReferralCijfers> {
  const [betalend, tegoedCent] = await Promise.all([ofNiets(telBetalend(userId)), ofNiets(telTegoed(userId))])
  return { betalend, tegoedCent }
}
