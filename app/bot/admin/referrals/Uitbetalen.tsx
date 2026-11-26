import { billingDb } from '@/lib/billing/db'
import { formatEuro } from '@/lib/billing/geld'
import { planReferral, type PlanRonde, type Voornemen } from '@/lib/billing/referralPlanner'
import { actieTabelOntbreekt } from '@/lib/billing/referralAutomatisch'
import { schakelaarAan } from '@/lib/billing/referralSchakelaars'
import { TERUGSTORT_OMSCHRIJVING } from '@/lib/billing/referralTeksten'
import type { ActieRij } from '@/lib/billing/referralTerugstorten'

// Alleen lezen: wat de uitvoerronde zou doen (droogloop) en wat er openstaat. Een fout hier mag de rest van het
// overzicht niet raken.

const muted: React.CSSProperties = { color: '#6b7280', fontSize: 14, marginBottom: 8 }
const let_op: React.CSSProperties = { color: '#f59e0b', fontSize: 14, marginBottom: 8 }
const sectionLabel: React.CSSProperties = { fontSize: 12, letterSpacing: 2, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', margin: '32px 0 12px' }
const tabel: React.CSSProperties = { width: '100%', fontSize: 13, color: '#9ca3af', borderCollapse: 'collapse' }
const rijStijl: React.CSSProperties = { borderBottom: '1px solid #1f2937' }
const cel: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', verticalAlign: 'top' }
const kop: React.CSSProperties = { ...cel, color: '#6b7280', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }

const SOORT: Record<Voornemen['soort'] | 'voordeel_team' | 'tegoed_overslaan' | 'tegoed_teamkorting', string> = {
  voordeel_jaar: 'Jaarkorting', voordeel_maand: 'Gratis maand', tegoed_terugstorten: 'Tegoed', verval_teamlid: 'Verval teamlid',
  voordeel_team: 'Teammaand', tegoed_overslaan: 'Tegoed (overslaan)', tegoed_teamkorting: 'Teamkorting',
}
const STAND: Record<Voornemen['stand'], string> = {
  klaar: 'Zou nu gebeuren', wacht: 'Wacht', 'niet-automatisch': 'Niet vanzelf', gereserveerd: 'Gereserveerd', vervalt: 'Zou vervallen',
}

async function haalPlan(): Promise<PlanRonde | string> {
  try {
    return await planReferral(new Date(), { uitvoeren: false })
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

async function haalOpenActies(): Promise<ActieRij[] | string> {
  const { data, error } = await billingDb.from('arnobot_referral_acties').select('*')
    .in('status', ['gereserveerd', 'bezig', 'verzonden', 'vastgelopen']).order('created_at', { ascending: false }).limit(100)
  if (error) return actieTabelOntbreekt(error) ? [] : error.message
  return (data ?? []) as ActieRij[]
}

export default async function Uitbetalen({ naam }: { naam: (id: string) => string }) {
  const [plan, open] = await Promise.all([haalPlan(), haalOpenActies()])
  const aan = schakelaarAan('REFERRAL_TERUGSTORTEN')
  const teksten = Object.keys(TERUGSTORT_OMSCHRIJVING).length > 0
  return (
    <>
      <p style={sectionLabel}>Uitbetalen: droogloop</p>
      <p style={muted}>
        Dit scherm verandert niets. Terugstorten staat {aan ? 'AAN' : 'uit'}{teksten ? '' : ', en de tekst die de klant bij een terugstorting ziet is niet vastgesteld, dus er wordt niets gereserveerd'}.
        {' '}Wat al met de hand per bank is gegeven ziet de app niet: boek dat in voordat terugstorten aan gaat.
      </p>
      {typeof plan === 'string' ? <p style={let_op}>Droogloop niet te maken: {plan}</p> : (
        <>
          {plan.sqlOntbreekt && <p style={let_op}>docs/sql/2026-11-26-referral-verrekening.sql is niet uitgevoerd: er kan niets gereserveerd worden.</p>}
          {plan.opMeeloop && <p style={let_op}>Het tegoed is berekend op de MEELOOPREGELS, omdat er nog geen echte grootboekregels zijn. Met deze regels gebeurt nooit iets.</p>}
          {plan.fouten.map(f => <p key={f} style={let_op}>Niet te beoordelen: {f}</p>)}
          {plan.voornemens.length === 0 ? <p style={muted}>Er is nu niets uit te keren.</p> : (
            <table style={tabel}>
              <thead><tr><th style={kop}>Wat</th><th style={kop}>Wie</th><th style={kop}>Bedrag</th><th style={kop}>Betaling</th><th style={kop}>Stand</th></tr></thead>
              <tbody>
                {plan.voornemens.map((v, i) => (
                  <tr key={i} style={rijStijl}>
                    <td style={cel}>{SOORT[v.soort]}{v.opMeeloop ? ' (meeloop)' : ''}</td>
                    <td style={cel}>{naam(v.userId)}</td>
                    <td style={cel}>{v.brutoCent !== null ? formatEuro(v.brutoCent) : v.nettoCent !== null ? `${formatEuro(v.nettoCent)} excl. btw` : ''}</td>
                    <td style={cel}>{v.betaalkenmerk ?? ''}</td>
                    <td style={cel}>{STAND[v.stand]}: {v.reden}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <p style={sectionLabel}>Openstaande uitkeringen</p>
      {Array.isArray(open) && open.some(a => a.status === 'vastgelopen') && (
        <p style={let_op}>
          Vastgelopen: kijk eerst in Mollie. Is het bedrag WEL teruggestort, dan in de SQL Editor referral_bevestig_met_de_hand(actie, &apos;re_...&apos;, toelichting).
          Is het zeker NIET teruggestort, dan referral_vrijgeven(actie, &apos;vastgelopen&apos;, &apos;vrijgegeven&apos;, toelichting). Gebruik referral_vrijgeven nooit als het geld weg is.
        </p>
      )}
      {typeof open === 'string' ? <p style={let_op}>Niet op te halen: {open}</p> : open.length === 0 ? <p style={muted}>Niets open.</p> : (
        <table style={tabel}>
          <thead><tr><th style={kop}>Sinds</th><th style={kop}>Wat</th><th style={kop}>Wie</th><th style={kop}>Bedrag</th><th style={kop}>Status</th></tr></thead>
          <tbody>
            {open.map(a => (
              <tr key={a.id} style={rijStijl}>
                <td style={cel}>{a.created_at ? new Date(a.created_at).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' }) : ''}</td>
                <td style={cel}>{SOORT[a.soort as keyof typeof SOORT] ?? a.soort}</td>
                <td style={cel}>{naam(a.user_id)}</td>
                <td style={cel}>{formatEuro(a.bruto_cent)}</td>
                <td style={{ ...cel, color: a.status === 'vastgelopen' ? '#ef4444' : '#9ca3af' }}>{a.status}{a.fout ? `: ${a.fout}` : ''} ({a.id})</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
