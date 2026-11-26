import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import AdminNav from '../AdminNav'
import BesluitFormulier from './BesluitFormulier'
import Uitbetalen from './Uitbetalen'
import { billingDb } from '@/lib/billing/db'
import { formatEuro } from '@/lib/billing/geld'
import { MEELOOP, draaiGrootboek, openVervalVraag, saldoPerAanbrenger, type GrootboekRegel, type ReferralStand } from '@/lib/billing/referralGrootboek'

export const dynamic = 'force-dynamic'

const h1: React.CSSProperties = { fontFamily: 'inherit', fontWeight: 700, fontSize: 32, letterSpacing: -1, color: '#f1f5f9', marginBottom: 8 }
const muted: React.CSSProperties = { color: '#6b7280', fontSize: 14 }
const sectionLabel: React.CSSProperties = { fontSize: 12, letterSpacing: 2, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', margin: '32px 0 12px' }
const tabel: React.CSSProperties = { width: '100%', fontSize: 13, color: '#9ca3af', borderCollapse: 'collapse' }
const rijStijl: React.CSSProperties = { borderBottom: '1px solid #1f2937' }
const cel: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', verticalAlign: 'top' }
const kop: React.CSSProperties = { ...cel, color: '#6b7280', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }

const SOORT_LABEL: Record<GrootboekRegel['soort'], string> = {
  toekenning: 'Toekennen', afwijzing: 'Niets toekennen', vaststelling: 'Bedrag vast', verval: 'Vervallen', handwerk: 'Zelf beoordelen',
  verrekening: 'Verrekend', vrijgave: 'Teruggezet', terugdraaiing: 'Teruggedraaid', herstel: 'Hersteld',
}

const dag = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' }) : '')
const bedrag = (cent: number | null) => (cent === null ? 'bedrag volgt' : cent === 0 ? '' : `${cent < 0 ? '-' : ''}${formatEuro(Math.abs(cent))}`)

function standTekst(s: ReferralStand): { tekst: string; kleur: string } {
  if (s.stand === 'uitgesloten') return { tekst: 'Testaccount, telt niet mee', kleur: '#6b7280' }
  if (s.stand === 'afgehandeld') return { tekst: 'Beslist, zie de regels hieronder', kleur: '#6b7280' }
  if (s.stand === 'handwerk_open') return { tekst: `Zelf beoordelen: ${s.reden}`, kleur: '#f59e0b' }
  if (s.stand === 'fout') return { tekst: `Niet te beoordelen: ${s.fout}`, kleur: '#ef4444' }
  const b = s.beoordeling
  if (b.uitkomst === 'wacht') return { tekst: `Wacht: ${b.reden}`, kleur: '#9ca3af' }
  if (b.uitkomst === 'handwerk') return { tekst: `Zelf beoordelen: ${b.reden}`, kleur: '#f59e0b' }
  if (b.uitkomst === 'afwijzen') return { tekst: `Niets toekennen: ${b.reden}`, kleur: '#9ca3af' }
  return { tekst: `Toekennen: ${b.nettoCent === null ? 'bedrag volgt' : formatEuro(b.nettoCent)}, ${b.reden}`, kleur: '#22c55e' }
}

export default async function ReferralsAdminPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  // Alleen lezen: het overzicht rekent de stand van nu uit, het wegschrijven doet de dagelijkse cron.
  const run = await draaiGrootboek(new Date(), { schrijf: false })

  const ids = [...new Set(run.referrals.flatMap(r => [r.referral.referrer_user_id, r.referral.referred_user_id]))]
  const { data: gebruikers } = ids.length
    ? await billingDb.from('approved_users').select('user_id, voornaam, achternaam, email').in('user_id', ids)
    : { data: [] }
  const namen = new Map((gebruikers ?? []).map(g => [g.user_id as string, [g.voornaam, g.achternaam].filter(Boolean).join(' ') || (g.email as string)]))
  const naam = (id: string) => namen.get(id) ?? id

  // Wat alleen in dit scherm is uitgerekend (en dus nog niet is opgeslagen) hoort niet in de lijst met opgeslagen regels.
  const nogNiet = new Set(run.nieuw.map(r => r.event_key))
  const opgeslagen = run.regels.filter(r => !nogNiet.has(r.event_key))
  const saldi = [...saldoPerAanbrenger(opgeslagen)].filter(([, cent]) => cent !== 0)

  return (
    <div style={{ background: '#111827', minHeight: '100vh', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <AdminNav active="/bot/admin/referrals" />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={h1}>REFERRALS</h1>
        <p style={muted}>{MEELOOP ? 'Meeloopstand: er verandert niets aan tegoed, betalingen of toegang. ' : ''}Bedragen zijn exclusief btw.</p>
        {run.migratieOntbreekt && (
          <p style={{ color: '#f59e0b', fontSize: 14, marginTop: 8 }}>De tabel ontbreekt nog: voer docs/sql/2026-11-25-referral-grootboek.sql uit. Tot dan wordt er niets opgeslagen.</p>
        )}

        <p style={sectionLabel}>Stand van nu</p>
        {run.referrals.length === 0 ? <p style={muted}>Nog geen referrals.</p> : (
          <table style={tabel}>
            <thead><tr><th style={kop}>Aangemeld</th><th style={kop}>Aanbrenger</th><th style={kop}>Nieuwe gebruiker</th><th style={kop}>Stand</th></tr></thead>
            <tbody>
              {run.referrals.map(s => {
                const t = standTekst(s)
                return (
                  <tr key={s.referral.id} style={rijStijl}>
                    <td style={cel}>{dag(s.referral.created_at)}</td>
                    <td style={cel}>{naam(s.referral.referrer_user_id)}</td>
                    <td style={cel}>{naam(s.referral.referred_user_id)}</td>
                    <td style={{ ...cel, color: t.kleur }}>
                      {t.tekst}
                      {s.stand === 'handwerk_open' && <BesluitFormulier referralId={String(s.referral.id)} />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        <p style={sectionLabel}>Saldo per aanbrenger</p>
        {saldi.length === 0 ? <p style={muted}>Niemand heeft saldo.</p> : (
          <table style={tabel}>
            <tbody>
              {saldi.map(([id, cent]) => (
                <tr key={id} style={rijStijl}><td style={cel}>{naam(id)}</td><td style={{ ...cel, textAlign: 'right' }}>{bedrag(cent)}</td></tr>
              ))}
            </tbody>
          </table>
        )}

        <Uitbetalen naam={naam} />

        <p style={sectionLabel}>Grootboek</p>
        {opgeslagen.length === 0 ? <p style={muted}>Nog geen regels.</p> : (
          <table style={tabel}>
            <thead><tr><th style={kop}>Datum</th><th style={kop}>Wat</th><th style={kop}>Aanbrenger</th><th style={kop}>Nieuwe gebruiker</th><th style={kop}>Bedrag</th><th style={kop}>Reden</th></tr></thead>
            <tbody>
              {[...opgeslagen].reverse().map(r => (
                <tr key={r.event_key} style={rijStijl}>
                  <td style={cel}>{dag(r.created_at)}</td>
                  <td style={cel}>{r.event_key.startsWith('verval-behoud:') ? 'Behouden' : SOORT_LABEL[r.soort]}</td>
                  <td style={cel}>{naam(r.aanbrenger_user_id)}</td>
                  <td style={cel}>{naam(r.klant_user_id)}</td>
                  <td style={cel}>{bedrag(r.netto_cent)}</td>
                  <td style={cel}>
                    {r.reden}
                    {openVervalVraag(opgeslagen, r.referral_id)?.event_key === r.event_key && <BesluitFormulier referralId={r.referral_id} verval />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
