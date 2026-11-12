import * as Sentry from '@sentry/nextjs'
import { billingDb, type SubRow } from './db'
import { haalAbonnement, heeftGeldigeMachtiging, maakAbonnement } from './mollie'
import { GEPLAND_LEEG } from './overstap'
import { abonnementVoorOverstap } from './perioden'
import { berekenBedrag, planNaam } from './prijzen'
import { verstuurBillingMail } from './mails'
import { soloStoptVoorTeam } from './soloNaarTeam'
import { stopEnBevestig } from './verwerking'
import { notifyTelegram } from '@/lib/cron-notify'

// Terug op een eerdere keuze (docs/OVERSTAP_PLAN.md): een geplande overstap intrekken, of een
// opzegging intrekken zolang het abonnement nog loopt. Beide maken zo nodig het Mollie-abonnement
// opnieuw aan dat bij het plannen of opzeggen is gestopt, en volgen dezelfde veilige volgorde als de
// overstap: eerst het nieuwe abonnement aanmaken, dan de database bijwerken, en bij een mislukking
// de vorige stap terugdraaien, zodat er nooit stil twee lopende abonnementen of geen blijven staan.

/** Mollie wil een startdatum in de toekomst: een abonnement opnieuw aanmaken kan tot 1 dag vooraf. */
export const MIN_DAGEN_INTREKKEN = 1

const DAG_MS = 24 * 60 * 60 * 1000

export type IntrekUitkomst = { ok: true } | { ok: false; status: number; fout: string }

const weiger = (status: number, fout: string): IntrekUitkomst => ({ ok: false, status, fout })
const ONGEDAAN = 'Er is niets gewijzigd. Probeer het zo opnieuw of mail admin@arno.bot.'

/** Het nieuwe abonnement is aangemaakt maar de database bijwerken lukt niet: eenmaal opnieuw proberen. */
async function updateMetEenHerkansing(maak: () => PromiseLike<{ data: { id: string }[] | null; error: { message: string } | null }>): Promise<{ data: { id: string }[] | null; error: { message: string } | null }> {
  const eerste = await maak()
  if (!eerste.error) return eerste
  return maak()
}

/**
 * Trekt een geplande overstap in. Het geplande abonnement wordt gestopt en het abonnement van vóór de
 * overstap komt terug, startend op de ingangsdatum van de overstap (dezelfde datum waarop de klant
 * toch al zou betalen). Kan tot 1 dag vóór die datum.
 */
export async function trekOverstapIn(userId: string, nu: Date = new Date()): Promise<IntrekUitkomst> {
  const { data: sub } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubRow>()
  if (!sub) return weiger(404, 'Geen lopend abonnement gevonden')
  if (!sub.gepland_at && !sub.gepland_mollie_subscription_id) return weiger(409, 'Er staat geen wijziging gepland')
  const geplandId = sub.gepland_mollie_subscription_id
  if (!geplandId || !sub.gepland_ingangs_at) return weiger(409, 'Deze wijziging kan niet automatisch worden ingetrokken. Mail naar admin@arno.bot.')
  const ingang = new Date(sub.gepland_ingangs_at)
  if ((ingang.getTime() - nu.getTime()) / DAG_MS < MIN_DAGEN_INTREKKEN) {
    return weiger(409, 'Je overstap gaat bijna in. Intrekken kan niet meer, mail naar admin@arno.bot.')
  }

  try {
    if (!(await heeftGeldigeMachtiging(sub.mollie_customer_id))) {
      return weiger(409, 'Er is geen geldige betaalmachtiging meer. Mail naar admin@arno.bot.')
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-intrekken-controle' } })
    return weiger(502, 'Controleren bij de betaalprovider is niet gelukt. Probeer het zo opnieuw.')
  }

  // 1. Het abonnement van vóór de overstap opnieuw aanmaken, startend op de ingangsdatum.
  const oud = abonnementVoorOverstap(ingang, sub.cyclus, sub.klant_type)
  let herstelId: string
  try {
    const ms = await maakAbonnement({
      klantId: sub.mollie_customer_id,
      brutoCent: sub.bedrag_cent,
      interval: oud.interval,
      times: oud.times,
      startDatum: oud.startDatum,
      omschrijving: `ArnoBot ${planNaam(sub.plan)} ${sub.cyclus} (overstap ingetrokken)`,
      metadata: { userId, subscriptionRowId: sub.id },
      idempotencyKey: `intrekken-${sub.id}-${sub.gepland_at ?? geplandId}`,
    })
    herstelId = ms.id
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-intrekken-aanmaken' } })
    return weiger(502, `Intrekken is niet gelukt. ${ONGEDAAN}`)
  }

  // 2. Het geplande abonnement stoppen en bij Mollie bevestigen. Lukt dat niet: het zojuist aangemaakte weer stoppen.
  if (!(await stopEnBevestig(sub, geplandId, 'gepland'))) {
    if (!(await stopEnBevestig(sub, herstelId, 'ongeregistreerd'))) {
      await notifyTelegram(`INTREKKEN HALF AFGEROND, GEEN DUBBELE INCASSO TOELATEN op arno.bot\n\nUser: ${userId}\nGepland abonnement: ${geplandId}\nNieuw aangemaakt: ${herstelId}\nBeide staan mogelijk actief. Stop er één in het Mollie-dashboard en controleer arnobot_subscriptions (${sub.id}).`)
    }
    return weiger(502, `Intrekken is niet gelukt. ${ONGEDAAN}`)
  }

  // 3. De rij terugzetten: het nieuwe abonnement wordt het huidige, de geplande wijziging vervalt.
  const nuIso = nu.toISOString()
  const { data, error } = await updateMetEenHerkansing(() =>
    billingDb
      .from('arnobot_subscriptions')
      .update({ ...GEPLAND_LEEG, mollie_subscription_id: herstelId, mollie_sub_geannuleerd_at: null, updated_at: nuIso })
      .eq('id', sub.id)
      .eq('gepland_mollie_subscription_id', geplandId)
      .select('id')
      .returns<{ id: string }[]>(),
  )
  if (error) {
    // Het geplande abonnement is al gestopt en het herstelde loopt, maar staat niet in de rij: dringend nakijken.
    Sentry.captureException(new Error(error.message), { tags: { onderdeel: 'billing-intrekken-opslaan' } })
    await notifyTelegram(`INTREKKEN: RIJ NIET BIJGEWERKT op arno.bot\n\nUser: ${userId}\nHersteld abonnement (actief): ${herstelId}\nGepland abonnement (gestopt): ${geplandId}\nZet mollie_subscription_id van ${sub.id} op ${herstelId} en wis de gepland_-kolommen.`)
    return weiger(502, 'Intrekken is niet helemaal gelukt. Wij zijn op de hoogte, mail zo nodig admin@arno.bot.')
  }
  if (data?.length !== 1) {
    // Een gelijktijdige aanvraag was ons voor. Is hun herstelde abonnement een ander, dan het onze weer stoppen.
    const { data: actueel } = await billingDb.from('arnobot_subscriptions').select('mollie_subscription_id').eq('id', sub.id).maybeSingle<{ mollie_subscription_id: string | null }>()
    if (actueel?.mollie_subscription_id !== herstelId) await stopEnBevestig(sub, herstelId, 'ongeregistreerd')
    return { ok: true }
  }

  await notifyTelegram(`Overstap ingetrokken op arno.bot\n\nUser: ${userId}\nBlijft: ${planNaam(sub.plan)} ${sub.cyclus}, ${sub.klant_type}\nVolgende betaling: ${ingang.toISOString().slice(0, 10)}`).catch(() => {})
  return { ok: true }
}

/**
 * Trekt een opzegging in zolang het abonnement nog loopt. Is het Mollie-abonnement bij het opzeggen
 * gestopt (particulier, of zakelijk met tijdige opzegging), dan komt er een nieuw abonnement vanaf het
 * einde van de betaalde periode, kan dat tot 1 dag daarvoor. Loopt het Mollie-abonnement nog (zakelijk
 * te laat opgezegd) of heeft het er geen (particulier jaar), dan hoeft er bij Mollie niets te gebeuren.
 */
export async function trekOpzeggingIn(userId: string, nu: Date = new Date()): Promise<IntrekUitkomst> {
  const { data: sub } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubRow>()
  if (!sub || !sub.periode_einde) return weiger(404, 'Geen opgezegd abonnement gevonden')
  if (sub.gepland_at || sub.gepland_mollie_subscription_id) {
    return weiger(409, 'Deze opzegging kan niet automatisch worden ingetrokken. Mail naar admin@arno.bot.')
  }
  // Gestopt omdat de klant Team wordt: intrekken zou een nieuw solo-abonnement naast het Team maken.
  if (await soloStoptVoorTeam(userId, nu)) {
    return weiger(409, 'Je solo-abonnement stopt omdat je naar Team gaat. Dit kan niet worden ingetrokken. Mail naar admin@arno.bot.')
  }
  const periodeEinde = new Date(sub.periode_einde)
  if (sub.opzegging_ingaat_at && new Date(sub.opzegging_ingaat_at).getTime() <= nu.getTime()) {
    return weiger(409, 'Je abonnement is al afgelopen. Rond een nieuwe betaling af.')
  }

  const nuIso = nu.toISOString()
  const klaarmaken = { status: 'active', opzegging_aangevraagd_at: null, opzegging_ingaat_at: null, updated_at: nuIso }
  const heractiveer = async (extra: Record<string, unknown>) =>
    billingDb
      .from('arnobot_subscriptions')
      .update({ ...klaarmaken, ...extra })
      .eq('id', sub.id)
      .eq('status', 'cancelled')
      .select('id')
      .returns<{ id: string }[]>()
  const wisOpzeggingOpAccount = () => billingDb.from('approved_users').update({ cancelled_at: null }).eq('user_id', userId)

  let nieuwId: string | null = null
  let upgradeHerstel: { brutoCent: number; btwCent: number } | null = null
  let geplandeStart = ''
  try {
    if (sub.mollie_subscription_id && !sub.mollie_sub_geannuleerd_at) {
      // Het Mollie-abonnement loopt nog: controleren dat het echt actief is.
      const ms = await haalAbonnement(sub.mollie_customer_id, sub.mollie_subscription_id)
      if (ms.status !== 'active') return weiger(409, 'Deze opzegging kan niet automatisch worden ingetrokken. Mail naar admin@arno.bot.')
    } else if (sub.mollie_subscription_id) {
      // Het Mollie-abonnement is gestopt: een nieuw aanmaken vanaf het einde van de betaalde periode.
      if ((periodeEinde.getTime() - nu.getTime()) / DAG_MS < MIN_DAGEN_INTREKKEN) {
        return weiger(409, 'Je abonnement loopt bijna af. Je kunt opnieuw afrekenen zodra het is afgelopen.')
      }
      if (!(await heeftGeldigeMachtiging(sub.mollie_customer_id))) {
        return weiger(409, 'Er is geen geldige betaalmachtiging meer. Rond een nieuwe betaling af zodra je abonnement is afgelopen.')
      }
      const nieuw = abonnementVoorOverstap(periodeEinde, sub.cyclus, sub.klant_type)
      // Een upgrade naar Pro die nog niet is omgezet: het plan staat al op Pro, maar het bedrag op de rij is nog
      // dat van Basic en het Pro-abonnement is bij het opzeggen gestopt. Het nieuwe abonnement moet dan het
      // Pro-bedrag krijgen, en terugkomen als geplande wijziging, precies zoals na de upgrade zelf: dan zet de
      // eerste Pro-betaling het om, en zet een mislukte bijbetaling het plan weer terug naar Basic.
      if (sub.plan === 'premium' && sub.bedrag_cent === berekenBedrag('basis', sub.cyclus, sub.klant_type).brutoCent) {
        upgradeHerstel = berekenBedrag('premium', sub.cyclus, sub.klant_type)
      }
      const ms = await maakAbonnement({
        klantId: sub.mollie_customer_id,
        brutoCent: upgradeHerstel ? upgradeHerstel.brutoCent : sub.bedrag_cent,
        interval: nieuw.interval,
        times: nieuw.times,
        startDatum: nieuw.startDatum,
        omschrijving: `ArnoBot ${planNaam(sub.plan)} ${sub.cyclus} (opzegging ingetrokken)`,
        metadata: { userId, subscriptionRowId: sub.id },
        idempotencyKey: `opzegging-intrekken-${sub.id}-${sub.opzegging_aangevraagd_at ?? sub.created_at ?? nuIso}`,
      })
      nieuwId = ms.id
      geplandeStart = nieuw.startDatum.toISOString()
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-opzegging-intrekken' } })
    return weiger(502, `Intrekken is niet gelukt. ${ONGEDAAN}`)
  }

  const { data, error } = await updateMetEenHerkansing(() =>
    heractiveer(
      !nieuwId
        ? {}
        : upgradeHerstel
          // De rij houdt het gestopte basisabonnement (bewaking blijft gezet); het Pro-abonnement is de geplande wijziging.
          ? {
              gepland_plan: 'premium',
              gepland_cyclus: sub.cyclus,
              gepland_bedrag_cent: upgradeHerstel.brutoCent,
              gepland_btw_cent: upgradeHerstel.btwCent,
              gepland_mollie_subscription_id: nieuwId,
              gepland_mollie_sub_geannuleerd_at: null,
              gepland_ingangs_at: geplandeStart,
              gepland_at: nuIso,
            }
          : { mollie_subscription_id: nieuwId, mollie_sub_geannuleerd_at: null },
    ),
  )
  if (error || data?.length !== 1) {
    // Niet bijgewerkt: een zojuist aangemaakt abonnement mag niet blijven staan zonder dat de rij ervan weet.
    if (nieuwId) await stopEnBevestig(sub, nieuwId, 'ongeregistreerd')
    if (error) {
      Sentry.captureException(new Error(error.message), { tags: { onderdeel: 'billing-opzegging-intrekken-opslaan' } })
      return weiger(502, `Intrekken is niet gelukt. ${ONGEDAAN}`)
    }
    return weiger(409, 'Deze opzegging is al ingetrokken of afgehandeld.')
  }
  await wisOpzeggingOpAccount()

  await verstuurBillingMail(userId, 'opzegging_ingetrokken', {
    datum: periodeEinde.toISOString(),
    // Particulier jaar heeft geen automatische betaling: dan volgt aan het einde de verlengvraag.
    metBetaling: !!sub.mollie_subscription_id,
  })
  await notifyTelegram(`Opzegging ingetrokken op arno.bot\n\nUser: ${userId}\nBlijft: ${planNaam(sub.plan)} ${sub.cyclus}, ${sub.klant_type}\n${nieuwId ? `Nieuw Mollie-abonnement vanaf ${periodeEinde.toISOString().slice(0, 10)}` : 'Het Mollie-abonnement liep nog door'}`).catch(() => {})
  return { ok: true }
}
