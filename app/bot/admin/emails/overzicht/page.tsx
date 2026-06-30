import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function EmailsOverzichtPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; }
        @media print {
          body { background: #fff; color: #111; }
          .no-print { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          h2 { page-break-after: avoid; }
        }
      `}</style>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '60px 40px 80px' }}>

        <div className="no-print" style={{ marginBottom: 40, display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="/bot/admin/emails" style={{ fontSize: 12, letterSpacing: 3, color: '#6b7280', textDecoration: 'none' }}>← TERUG</a>
          <button onClick={() => window.print()}
            style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: 2, padding: '6px 16px', border: '1px solid #374151', borderRadius: 3, background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}>
            AFDRUKKEN / OPSLAAN ALS PDF
          </button>
        </div>

        <p style={{ fontFamily: 'Space Mono', fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 48, letterSpacing: 3, color: '#f1f5f9', marginBottom: 8 }}>Totaaloverzicht e-mails</h1>
        <p style={{ fontSize: 13, color: '#6b7280', letterSpacing: 1, marginBottom: 56 }}>Alle e-mails en crons die ArnoBot verstuurt, gesorteerd per categorie.</p>

        <Section title="NAAR GEBRUIKERS" subtitle="Lifecycle e-mails richting actieve en voormalige gebruikers">
          <Table rows={[
            { name: 'Dag 1', trigger: 'Cron — trial-emails (dagelijks 06:05)', ontvanger: 'Gebruiker', wanneer: 'Direct na aanmelding', type: 'Transactioneel' },
            { name: 'Dag 4', trigger: 'Cron — trial-emails (dagelijks 06:05)', ontvanger: 'Gebruiker', wanneer: '4 dagen na aanmelding, nog geen gesprek', type: 'Transactioneel' },
            { name: 'Geen gesprek nudge', trigger: 'Cron — inactivity-nudge (dagelijks 05:00)', ontvanger: 'Gebruiker', wanneer: 'Dag 7, nooit een gesprek gestart', type: 'Marketing' },
            { name: 'Eerste gesprek', trigger: 'Cron — trial-emails (dagelijks 06:05)', ontvanger: 'Gebruiker', wanneer: 'Na het eerste gesprek', type: 'Transactioneel' },
            { name: 'Dag 14', trigger: 'Cron — trial-emails (dagelijks 06:05)', ontvanger: 'Gebruiker', wanneer: 'Halverwege de trial', type: 'Transactioneel' },
            { name: 'Inactivity nudge', trigger: 'Cron — inactivity-nudge (dagelijks 05:00)', ontvanger: 'Gebruiker', wanneer: '7 dagen geen activiteit', type: 'Marketing' },
            { name: 'Eerste coaching', trigger: 'Cron — trial-emails (dagelijks 06:05)', ontvanger: 'Gebruiker', wanneer: 'Na 5+ sessies, nog geen coaching aangevraagd', type: 'Transactioneel' },
            { name: 'Dag 25', trigger: 'Cron — trial-emails (dagelijks 06:05)', ontvanger: 'Gebruiker', wanneer: 'Trial loopt over 5 dagen af, opt-in CTA', type: 'Transactioneel' },
            { name: 'Betaalwaarschuwing', trigger: 'Cron — trial-emails (dagelijks 06:05)', ontvanger: 'Gebruiker', wanneer: '7 dagen na opt-in, geen betaling ontvangen', type: 'Transactioneel' },
            { name: 'Geblokkeerd', trigger: 'Cron — trial-emails (dagelijks 06:05)', ontvanger: 'Gebruiker', wanneer: '24u na waarschuwing, nog geen betaling', type: 'Transactioneel' },
            { name: 'Trial afgelopen', trigger: 'Cron — trial-emails (dagelijks 06:05)', ontvanger: 'Gebruiker', wanneer: 'Dag 30, nooit opt-in gedaan', type: 'Transactioneel' },
            { name: 'Opzegging bevestiging', trigger: 'Event — bot/cancel-subscription', ontvanger: 'Gebruiker', wanneer: 'Direct bij opzegging via account pagina', type: 'Transactioneel' },
            { name: 'Win-back', trigger: 'Cron — trial-emails (dagelijks 06:05)', ontvanger: 'Voormalig gebruiker', wanneer: '15 dagen na einde trial', type: 'Marketing' },
            { name: 'Referral aanmelding', trigger: 'Event — bot/referral (direct) + cron trial-emails', ontvanger: 'Referrer (gebruiker)', wanneer: 'Zodra iemand zich aanmeldt via de referral link', type: 'Transactioneel' },
            { name: 'BIEB bijgewerkt', trigger: 'Cron — auto-analyse (dagelijks 06:05)', ontvanger: 'Gebruiker', wanneer: 'Zodra 10+ nieuwe gesprekken beschikbaar voor analyse', type: 'Transactioneel' },
          ]} />
        </Section>

        <Section title="NAAR MIJZELF — GEPLANDE CRONS" subtitle="Automatische rapportages op vaste tijdstippen">
          <Table rows={[
            { name: 'Dagelijkse activiteit', trigger: 'Cron — daily-activity (dagelijks 05:00)', ontvanger: 'arno@royaldutchsales.com', wanneer: 'Elke ochtend, actieve gebruikers afgelopen 24u', type: 'Admin' },
            { name: 'Weekly top gebruikers', trigger: 'Cron — weekly-top-users (zaterdag 06:05)', ontvanger: 'analyses@arno.bot', wanneer: 'Elke zaterdag, top 10 actieve gebruikers', type: 'Admin' },
            { name: 'Competitie', trigger: 'Cron — competitie (maandelijks, 1e)', ontvanger: 'arno@arno.bot', wanneer: 'Eerste van de maand, competitierapport', type: 'Admin' },
            { name: 'Model-check', trigger: 'Cron — model-check (maandelijks, 1e)', ontvanger: 'model@arno.bot', wanneer: 'Eerste van de maand, modelkwaliteitscheck', type: 'Admin' },
            { name: 'Data-cleanup', trigger: 'Cron — data-cleanup (maandelijks, 1e)', ontvanger: 'hq@arno.bot', wanneer: 'Eerste van de maand, gebruikers te verwerken', type: 'Admin' },
            { name: 'Milestone-check', trigger: 'Cron — milestone-check (maandelijks, 1e)', ontvanger: 'hq@arno.bot', wanneer: 'Eerste van de maand, alert bij 50 actieve gebruikers', type: 'Admin' },
          ]} />
        </Section>

        <Section title="NAAR MIJZELF — EVENT-NOTIFICATIES" subtitle="Mails die vuren als een gebruiker iets doet, niet via een schema">
          <Table rows={[
            { name: 'Derde trial', trigger: 'Event — bot/herstart', ontvanger: 'arno@arno.bot', wanneer: 'Als een gebruiker een derde trial start', type: 'Admin' },
            { name: 'Opzegging (intern)', trigger: 'Event — bot/cancel-subscription', ontvanger: 'arno@arno.bot', wanneer: 'Direct bij opzegging door een gebruiker', type: 'Admin' },
            { name: 'Doorgaan bevestigd', trigger: 'Event — bot/confirm-renewal', ontvanger: 'arno@arno.bot', wanneer: 'Als een gebruiker doorgaan na trial bevestigt', type: 'Admin' },
            { name: 'Account verwijderd', trigger: 'Event — bot/delete-account', ontvanger: 'delete@arno.bot', wanneer: 'Als een gebruiker zijn account verwijdert', type: 'Admin' },
            { name: 'Evaluatie', trigger: 'Event — api/evaluatie', ontvanger: 'evaluatie@arno.bot', wanneer: 'Als een gebruiker een evaluatie instuurt', type: 'Admin' },
            { name: 'BIEB gedeeld', trigger: 'Event — bot/share-overview', ontvanger: 'Coach (extern e-mailadres)', wanneer: 'Als een gebruiker zijn BIEB deelt met een coach', type: 'Admin' },
            { name: 'Team waitlist', trigger: 'Event — bot/profiel', ontvanger: 'waitlist@arno.bot', wanneer: 'Als iemand zich aanmeldt voor de teamwaitlist', type: 'Admin' },
          ]} />
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #1f2937' }}>
          <p style={{ fontSize: 12, color: '#4b5563', letterSpacing: 1, lineHeight: 1.8 }}>
            Marketing-mails (inactivity nudge, geen gesprek nudge, win-back) bevatten een opt-out link via arno.bot/optout/&#123;userId&#125;.<br />
            Alle verstuurde mails zijn terug te vinden in het Resend-dashboard op resend.com/emails.<br />
            Gegenereerd: ArnoBot Admin — arno.bot
          </p>
        </div>

      </div>
    </>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 56 }}>
      <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 24, letterSpacing: 3, color: '#f59e0b', marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 12, color: '#6b7280', letterSpacing: 1, marginBottom: 20 }}>{subtitle}</p>
      {children}
    </div>
  )
}

function Table({ rows }: { rows: { name: string; trigger: string; ontvanger: string; wanneer: string; type: string }[] }) {
  const th: React.CSSProperties = {
    fontFamily: 'Space Mono',
    fontSize: 11,
    letterSpacing: 3,
    color: '#f59e0b',
    fontWeight: 400,
    textAlign: 'left',
    padding: '8px 12px 8px 0',
    borderBottom: '1px solid #1f2937',
    whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    fontFamily: 'Space Mono',
    fontSize: 12,
    color: '#9ca3af',
    padding: '10px 12px 10px 0',
    borderBottom: '1px solid #1f2937',
    verticalAlign: 'top',
    lineHeight: 1.7,
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...th, width: 160 }}>NAAM</th>
          <th style={{ ...th, width: 260 }}>TRIGGER</th>
          <th style={{ ...th, width: 180 }}>ONTVANGER</th>
          <th style={th}>WANNEER</th>
          <th style={{ ...th, width: 110 }}>TYPE</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ ...td, color: '#f1f5f9', fontWeight: 700 }}>{r.name}</td>
            <td style={{ ...td, color: '#6b7280' }}>{r.trigger}</td>
            <td style={td}>{r.ontvanger}</td>
            <td style={td}>{r.wanneer}</td>
            <td style={{ ...td, color: r.type === 'Marketing' ? '#f59e0b' : r.type === 'Transactioneel' ? '#9ca3af' : '#4b5563' }}>{r.type}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
