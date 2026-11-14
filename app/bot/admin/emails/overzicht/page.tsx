import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { CSSProperties } from 'react'

export const dynamic = 'force-dynamic'
import { PrintButton } from './PrintButton'
import { cronTrigger, leesCrons } from '@/lib/cronOverzicht'
import { leesCronRuns } from '@/lib/cronRun'
import { beoordeelCron, STAAT_KLEUR } from '@/lib/cronGezondheid'

export default async function EmailsOverzichtPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')
  const crons = leesCrons()
  const runs = await leesCronRuns()

  return (
    <div style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9' }}>
      <style href="overzicht-print" precedence="default">{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; }
          tr { page-break-inside: avoid; }
          h2 { page-break-after: avoid; }
        }
      `}</style>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 40px 80px' }}>

        <div className="no-print" style={{ marginBottom: 40, display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="/bot/admin/emails" style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#6b7280', textDecoration: 'none' }}>
            ← TERUG
          </a>
          <PrintButton />
        </div>

        <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontFamily: 'sans-serif', fontWeight: 700, fontSize: 48, letterSpacing: '-1px', color: '#f1f5f9', marginBottom: 8 }}>Totaaloverzicht e-mails</h1>
        <p style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
          Alle e-mails en crons die ArnoBot verstuurt, gesorteerd per categorie.
        </p>
        <p className="no-print" style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#6b7280', letterSpacing: 1, marginBottom: 48 }}>
          Let op: de cronlijst en de cron-tijden in dit overzicht komen automatisch uit vercel.json. De mail-rijen zelf zijn handmatig te onderhouden. De NAAR GEBRUIKERS sectie op de admin-pagina werkt automatisch via email-templates.ts.
        </p>

        <Section title="NAAR GEBRUIKERS" subtitle="Lifecycle e-mails richting actieve en voormalige gebruikers">
          <Table rows={[
            { name: 'Dag 1',                trigger: cronTrigger('trial-emails'),          ontvanger: 'Gebruiker',            wanneer: 'Direct na aanmelding',                                  type: 'Transactioneel' },
            { name: 'Dag 4',                trigger: cronTrigger('trial-emails'),          ontvanger: 'Gebruiker',            wanneer: '4 dagen na aanmelding, nog geen gesprek',               type: 'Transactioneel' },
            { name: 'Geen gesprek nudge',    trigger: cronTrigger('inactivity-nudge'),     ontvanger: 'Gebruiker',            wanneer: 'Dag 7, nooit een gesprek gestart',                      type: 'Marketing' },
            { name: 'Eerste gesprek',        trigger: cronTrigger('trial-emails'),          ontvanger: 'Gebruiker',            wanneer: 'Na het eerste gesprek',                                 type: 'Transactioneel' },
            { name: 'Dag 14',               trigger: cronTrigger('trial-emails'),          ontvanger: 'Gebruiker',            wanneer: 'Halverwege de trial',                                   type: 'Transactioneel' },
            { name: 'Inactivity nudge',      trigger: cronTrigger('inactivity-nudge'),     ontvanger: 'Gebruiker',            wanneer: '7 dagen geen activiteit',                               type: 'Marketing' },
            { name: 'Eerste coaching',       trigger: cronTrigger('trial-emails'),          ontvanger: 'Gebruiker',            wanneer: 'Na 5+ sessies, nog geen coaching aangevraagd',          type: 'Transactioneel' },
            { name: 'Dag 25',               trigger: cronTrigger('trial-emails'),          ontvanger: 'Gebruiker',            wanneer: 'Trial loopt over 5 dagen af, opt-in CTA',               type: 'Transactioneel' },
            { name: 'Betaalwaarschuwing',    trigger: cronTrigger('trial-emails'),          ontvanger: 'Gebruiker',            wanneer: '7 dagen na opt-in, geen betaling ontvangen',            type: 'Transactioneel' },
            { name: 'Geblokkeerd',           trigger: cronTrigger('trial-emails'),          ontvanger: 'Gebruiker',            wanneer: '24u na waarschuwing, nog geen betaling',                type: 'Transactioneel' },
            { name: 'Trial afgelopen',       trigger: cronTrigger('trial-emails'),          ontvanger: 'Gebruiker',            wanneer: 'Dag 30, nooit opt-in gedaan',                          type: 'Transactioneel' },
            { name: 'Opzegging bevestiging', trigger: 'Event: bot/cancel-subscription',               ontvanger: 'Gebruiker',            wanneer: 'Direct bij opzegging via account pagina',               type: 'Transactioneel' },
            { name: 'Win-back',             trigger: cronTrigger('trial-emails'),          ontvanger: 'Voormalig gebruiker',  wanneer: '15 dagen na einde trial',                               type: 'Marketing' },
            { name: 'Referral aanmelding',   trigger: 'Event: bot/referral (direct)',                 ontvanger: 'Referrer (gebruiker)', wanneer: 'Zodra iemand zich aanmeldt via de referral link',       type: 'Transactioneel' },
            { name: 'Blog bevestiging',     trigger: 'Event: api/blog/subscribe',                    ontvanger: 'Blogabonnee (aanmelder)', wanneer: 'Direct na aanmelden voor de blog, double opt-in',   type: 'Transactioneel' },
            { name: 'Blog al aangemeld',    trigger: 'Event: api/blog/subscribe',                    ontvanger: 'Blogabonnee (aanmelder)', wanneer: 'Opnieuw aangemeld terwijl het adres al bevestigd is', type: 'Transactioneel' },
            { name: 'Blog nieuw artikel',   trigger: 'Event/cron: admin/blog + cron/blog (elke 15 min)', ontvanger: 'Bevestigde blogabonnees', wanneer: 'Bij publicatie, binnen het dagbudget',          type: 'Marketing' },
            { name: 'Analyses bijgewerkt',   trigger: cronTrigger('auto-analyse'),          ontvanger: 'Gebruiker',            wanneer: 'Zodra 10+ nieuwe gesprekken beschikbaar voor analyse',  type: 'Transactioneel' },
          ]} />
        </Section>

        <Section title={`ALLE GEPLANDE CRONS (${crons.length})`} subtitle="Rechtstreeks uit vercel.json, dus altijd compleet. Tijden in UTC: Nederlandse tijd is 1 uur later in de winter en 2 uur later in de zomer.">
          <Table rows={crons.map(c => {
            const g = beoordeelCron(runs[c.pad], c.schema)
            return {
              name: c.naam,
              trigger: `${c.pad.split('/').pop()}: ${c.schemaTekst}`,
              ontvanger: c.ontvanger,
              wanneer: c.wat,
              type: c.soort === 'gebruikers' ? 'Gebruiker' : c.soort === 'mij' ? 'Admin' : 'Systeem',
              laatsteRun: g.tekst,
              laatsteRunKleur: STAAT_KLEUR[g.staat],
            }
          })} />
        </Section>

        <Section title="NAAR MIJZELF: EVENT-NOTIFICATIES" subtitle="Vuren als een gebruiker iets doet, niet via een schema">
          <Table rows={[
            { name: 'Opzegging (intern)',     trigger: 'Event: bot/cancel-subscription',              ontvanger: 'arno@arno.bot',       wanneer: 'Direct bij opzegging door een gebruiker',               type: 'Admin' },
            { name: 'Account verwijderd',    trigger: 'Event: bot/delete-account',                   ontvanger: 'delete@arno.bot',     wanneer: 'Als een gebruiker zijn account verwijdert',             type: 'Admin' },
            { name: 'Team-lead',             trigger: 'Event: bot/profiel',                          ontvanger: 'waitlist@arno.bot',   wanneer: 'Als iemand bij de intake "voor mijn team" kiest',       type: 'Admin' },
          ]} />
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #1f2937' }}>
          <p style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#6b7280', letterSpacing: 1, lineHeight: 1.8 }}>
            Marketing-mails (inactivity nudge, geen gesprek nudge, win-back) bevatten een opt-out link via arno.bot/optout/&#123;userId&#125;.<br />
            Alle verstuurde mails zijn terug te vinden op resend.com/emails.<br />
            ArnoBot Admin: arno.bot
          </p>
        </div>

      </div>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 56 }}>
      <h2 style={{ fontFamily: 'sans-serif', fontWeight: 700, fontSize: 20, letterSpacing: 1, color: '#f59e0b', marginBottom: 4 }}>{title}</h2>
      <p style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#6b7280', letterSpacing: 1, marginBottom: 20 }}>{subtitle}</p>
      {children}
    </div>
  )
}

type Row = { name: string; trigger: string; ontvanger: string; wanneer: string; type: string; laatsteRun?: string; laatsteRunKleur?: string }

function Table({ rows }: { rows: Row[] }) {
  const th: CSSProperties = {
    fontFamily: 'sans-serif',
    fontSize: 12,
    letterSpacing: 3,
    color: '#f59e0b',
    fontWeight: 400,
    textAlign: 'left',
    padding: '8px 12px 8px 0',
    borderBottom: '1px solid #1f2937',
    whiteSpace: 'nowrap',
  }
  const td: CSSProperties = {
    fontFamily: 'sans-serif',
    fontSize: 14,
    color: '#9ca3af',
    padding: '10px 12px 10px 0',
    borderBottom: '1px solid #1f2937',
    verticalAlign: 'top',
    lineHeight: 1.7,
  }
  return (
    <div className="admin-table-wrap">
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...th, width: 170 }}>NAAM</th>
          <th style={{ ...th, width: 280 }}>TRIGGER</th>
          <th style={{ ...th, width: 200 }}>ONTVANGER</th>
          <th style={th}>WANNEER</th>
          <th style={{ ...th, width: 120 }}>TYPE</th>
          {rows.some(r => r.laatsteRun) && <th style={{ ...th, width: 200 }}>LAATSTE RUN</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ ...td, color: '#f1f5f9', fontWeight: 700 }}>{r.name}</td>
            <td style={{ ...td, color: '#6b7280' }}>{r.trigger}</td>
            <td style={td}>{r.ontvanger}</td>
            <td style={td}>{r.wanneer}</td>
            <td style={{ ...td, color: r.type === 'Marketing' ? '#f59e0b' : r.type === 'Transactioneel' ? '#9ca3af' : '#6b7280' }}>{r.type}</td>
            {rows.some(x => x.laatsteRun) && <td style={{ ...td, color: r.laatsteRunKleur ?? '#6b7280' }}>{r.laatsteRun ?? ''}</td>}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}
