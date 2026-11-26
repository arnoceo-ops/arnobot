import * as Sentry from '@sentry/nextjs'
import { billingDb } from './db'
import { mollieIngeschakeld } from './mollie'
import { actieTabelBestaat } from './referralAutomatisch'
import { draaiNacontrole } from './referralNacontrole'
import { verstuurReferralMails } from './referralMails'
import { planReferral } from './referralPlanner'
import { CREDIT_ACTIESTATUSSEN, creditAfboeken, creditnotaStap } from './referralCreditnota'
import { verwerkOpenTerugstortingen, type ActieRij } from './referralTerugstorten'
import { magTerugstorten, schakelaarAan } from './referralSchakelaars'
import { regelTekst } from './referralGrootboek'
import { splitsBericht } from './berichtDelen'
import { formatEuro } from './geld'
import { wieIs } from './wie'
import { nieuwMelden } from '@/lib/capaciteit'
import { notifyTelegram } from '@/lib/cron-notify'
import { haalAlleRijen } from '@/lib/haalAlleRijen'

// De dagelijkse uitvoerronde: nacontrole, plannen, uitvoeren, melden. Een fout in het ene onderdeel houdt de andere niet
// tegen.

export interface UitvoerSamenvatting {
  overgeslagen?: 'mollie niet ingeschakeld' | 'sql ontbreekt'
  gecontroleerd: number
  geboekt: number
  gereserveerd: number
  uitgevoerd: number
  fouten: number
  meldingMislukt: boolean
}

const wie = async (userId: string) => wieIs(userId).catch(() => userId)

export async function draaiReferralUitvoeren(nu: Date): Promise<UitvoerSamenvatting> {
  const uit: UitvoerSamenvatting = { gecontroleerd: 0, geboekt: 0, gereserveerd: 0, uitgevoerd: 0, fouten: 0, meldingMislukt: false }
  if (!mollieIngeschakeld()) return { ...uit, overgeslagen: 'mollie niet ingeschakeld' }
  if (!(await actieTabelBestaat())) return { ...uit, overgeslagen: 'sql ontbreekt' }

  const regels: string[] = []
  const fouten: string[] = []
  /** Terugkerende signalen hooguit een keer per week. */
  const eensPerWeek = async (sleutel: string, tekst: string) => {
    if (await nieuwMelden(`referral:${sleutel}`, 'waarschuwing')) regels.push(tekst)
  }
  const onderdeel = async (naam: string, taak: () => Promise<void>) => {
    try {
      await taak()
    } catch (e) {
      Sentry.captureException(e, { tags: { onderdeel: 'referral-uitvoeren' }, extra: { naam } })
      fouten.push(`${naam}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  await onderdeel('nacontrole', async () => {
    const r = await draaiNacontrole(nu)
    uit.gecontroleerd = r.gecontroleerd
    uit.geboekt = r.geboekt.length
    for (const regel of r.geboekt) {
      regels.push(`${r.meeloop ? 'Meeloopstand, zonder gevolgen. ' : ''}${regelTekst(regel, await wie(regel.aanbrenger_user_id), await wie(regel.klant_user_id))}`)
    }
    if (r.vrijgegeven.length) regels.push(`${r.vrijgegeven.length} nog niet verstuurde verrekening(en) vrijgegeven na een terugdraaiing.`)
    for (const m of r.meldingen) await eensPerWeek(m.sleutel, m.tekst)
    fouten.push(...r.fouten.map(f => `nacontrole ${f}`))
  })

  // Met de schakelaar uit wordt er niets gepland. Wat er zou gebeuren staat op /bot/admin/referrals.
  if (schakelaarAan('REFERRAL_TERUGSTORTEN')) {
    await onderdeel('planner', async () => {
      const plan = await planReferral(nu, { uitvoeren: true })
      for (const v of plan.voornemens) {
        const bedrag = v.brutoCent !== null ? formatEuro(v.brutoCent) : v.nettoCent !== null ? `${formatEuro(v.nettoCent)} excl. btw` : ''
        const tekst = `${v.soort} voor ${await wie(v.userId)} ${bedrag}${v.betaalkenmerk ? ` op ${v.betaalkenmerk}` : ''}: ${v.reden}`
        if (v.stand === 'gereserveerd') { uit.gereserveerd++; regels.push(`Gereserveerd: ${tekst}`) }
        else if (v.stand === 'vervalt') regels.push(`Vervallen: ${tekst}`)
        // Wachten op bewijs mag niet onzichtbaar blijven.
        else if (v.bronNietBewezen) await eensPerWeek(`bron:${v.soort}:${v.userId}:${v.betalingId}`, `Wacht: ${tekst}`)
        else if (v.stand === 'niet-automatisch') {
          await eensPerWeek(`plan:${v.soort}:${v.userId}:${v.betalingId}:${v.reden}`, `Niet vanzelf: ${tekst}. Geef je dit met de hand, boek het dan in (functies referral_handmatig_ in de SQL).`)
        }
      }
      fouten.push(...plan.fouten.map(f => `planner ${f}`))
    })
  }

  // Altijd: wat al onderweg is wordt ook met de schakelaar uit afgehandeld.
  await onderdeel('terugstorten', async () => {
    const r = await verwerkOpenTerugstortingen(nu)
    uit.uitgevoerd = r.uitkomsten.filter(u => u.uitkomst === 'verzonden' || u.uitkomst === 'bevestigd').length
    fouten.push(...r.fouten)
  })

  await onderdeel('openstaand', async () => {
    const acties = await haalAlleRijen<ActieRij>((van, tot) => billingDb.from('arnobot_referral_acties').select('*')
      .in('status', ['gereserveerd', 'bezig', 'verzonden', ...CREDIT_ACTIESTATUSSEN]).order('id', { ascending: true }).range(van, tot))
    const stil = acties.filter(a => !CREDIT_ACTIESTATUSSEN.includes(a.status) && !magTerugstorten(a.soort)).length
    if (stil) {
      await eensPerWeek('open-terwijl-uit', `Een terugstortschakelaar staat uit terwijl er ${stil} referralterugstorting(en) openstaan (REFERRAL_TERUGSTORTEN, voor tegoed ook REFERRAL_TEGOED_VERREKENEN). Wat nog niet verstuurd is blijft staan, met het tegoed gereserveerd.`)
    }
    const zonderCreditnota: string[] = []
    for (const a of acties.filter(a => CREDIT_ACTIESTATUSSEN.includes(a.status) && (a.credit_status === 'nodig' || a.credit_status === 'bezig'))) {
      try {
        const stap = await creditnotaStap(a, nu)
        if (stap === 'handwerk') await eensPerWeek(`creditnota:${a.id}`, `Creditnota niet vanzelf (actie ${a.id}, ${formatEuro(a.bruto_cent)}): ${a.fout}`)
        else if (stap === 'mislukt') fouten.push(`${a.fout} (actie ${a.id})`)
        else if (stap === 'uit' || stap === 'wacht-op-factuur') zonderCreditnota.push(a.id)
      } catch (e) {
        fouten.push(`creditnota actie ${a.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (zonderCreditnota.length) {
      // Wie er zelf een maakt moet haar afboeken, anders komt er bij het aanzetten van de schakelaar mogelijk een tweede.
      await eensPerWeek('creditnotas', `${zonderCreditnota.length} referralterugstorting(en) hebben nog geen creditnota in Moneybird (de schakelaar REFERRAL_CREDITNOTA staat uit of de factuur ontbreekt). Maak je er zelf een, boek haar dan meteen af:\n${zonderCreditnota.slice(0, 5).map(creditAfboeken).join('\n')}${zonderCreditnota.length > 5 ? `\nEn nog ${zonderCreditnota.length - 5}: dezelfde opdracht met het kenmerk uit arnobot_referral_acties.` : ''}`)
    }
  })

  await onderdeel('klantmails', async () => {
    const r = await verstuurReferralMails(nu)
    if (r.mislukt) fouten.push(`${r.mislukt} referralmail(s) niet verstuurd (volgende ronde opnieuw)`)
  })

  uit.fouten = fouten.length
  if (fouten.length) regels.push(`Niet gelukt (morgen opnieuw):\n${fouten.slice(0, 5).join('\n')}`)
  if (regels.length) {
    for (const deel of splitsBericht('Referral uitvoeren op arno.bot', regels, 'https://www.arno.bot/bot/admin/referrals')) {
      if ((await notifyTelegram(deel)) === false) uit.meldingMislukt = true
    }
    if (uit.meldingMislukt) Sentry.captureMessage('Referral uitvoeren: Telegrammelding niet aangekomen', { level: 'error' })
  }
  return uit
}
