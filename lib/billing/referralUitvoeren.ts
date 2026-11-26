import * as Sentry from '@sentry/nextjs'
import { billingDb } from './db'
import { mollieIngeschakeld } from './mollie'
import { actieTabelBestaat } from './referralAutomatisch'
import { draaiNacontrole } from './referralNacontrole'
import { planReferral } from './referralPlanner'
import { creditnotaStap, verwerkOpenTerugstortingen, type ActieRij } from './referralTerugstorten'
import { schakelaarAan } from './referralSchakelaars'
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
      .in('status', ['gereserveerd', 'bezig', 'verzonden', 'bevestigd']).order('id', { ascending: true }).range(van, tot))
    const open = acties.filter(a => a.status !== 'bevestigd').length
    if (open && !schakelaarAan('REFERRAL_TERUGSTORTEN')) {
      await eensPerWeek('open-terwijl-uit', `REFERRAL_TERUGSTORTEN staat uit terwijl er ${open} referralterugstorting(en) openstaan.`)
    }
    let creditnotas = 0
    for (const a of acties.filter(a => a.status === 'bevestigd' && a.credit_status === 'nodig')) {
      const stap = await creditnotaStap(a)
      if (stap !== 'geen-factuur-testmodus' && stap !== 'niet-nodig') creditnotas++
    }
    if (creditnotas) {
      await eensPerWeek('creditnotas', `${creditnotas} referralterugstorting(en) hebben nog geen creditnota in Moneybird (de automatische creditnota is niet gebouwd).`)
    }
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
