import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import AdminNav from '../AdminNav'
import TeamBillingForm from './TeamBillingForm'
import { TEST_TEAM_ID } from '@/lib/internalTestAccounts'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const h1: React.CSSProperties = { fontFamily: 'inherit', fontWeight: 700, fontSize: 32, letterSpacing: -1, color: '#f1f5f9', marginBottom: 8 }
const muted: React.CSSProperties = { color: '#6b7280', fontSize: 14 }
const sectionLabel: React.CSSProperties = { fontSize: 12, letterSpacing: 2, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }

export default async function TeamsAdminPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const { data: teams } = await supabase
    .from('arnobot_teams')
    .select('id, name, manager_id, min_seats, cyclus, volgende_factuurdatum, geblokkeerd_at')
    .neq('id', TEST_TEAM_ID)
    .order('name')
  const managerIds = [...new Set((teams ?? []).map(t => t.manager_id))]

  const { data: managers } = managerIds.length
    ? await supabase.from('approved_users').select('user_id, email').in('user_id', managerIds)
    : { data: [] }
  const managerByIds = new Map((managers ?? []).map(m => [m.user_id, m.email]))

  const { data: klanten } = managerIds.length
    ? await supabase.from('arnobot_billing_customers').select('*').in('user_id', managerIds)
    : { data: [] }
  const klantByManager = new Map((klanten ?? []).map(k => [k.user_id, k]))

  const { data: openAanvragen } = await supabase
    .from('arnobot_command_requests')
    .select('bedrijfsnaam, aanvrager_naam, email, aantal_seats, cyclus, berekende_prijs_per_maand, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: facturenRaw } = await supabase
    .from('arnobot_team_facturen')
    .select('team_id, soort, seats_aantal, bedrag_cent, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  const facturenByTeam = new Map<string, typeof facturenRaw>()
  for (const f of facturenRaw ?? []) {
    const lijst = facturenByTeam.get(f.team_id) ?? []
    lijst.push(f)
    facturenByTeam.set(f.team_id, lijst)
  }

  return (
    <div style={{ background: '#111827', minHeight: '100vh', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <AdminNav active="/bot/admin/teams" />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={h1}>TEAMS</h1>
        <p style={{ ...muted, marginBottom: 32 }}>
          Seats, cyclus, eerstvolgende factuurdatum en bedrijfsgegevens per team. Leeg = nog niet geactiveerd voor
          automatische facturatie (de cron slaat dat team over). Bron van waarheid voor seats bij facturatie: het
          actuele aantal leden in het team, nooit onder het hier ingestelde minimum.
        </p>

        {(teams ?? []).map(team => {
          const klant = klantByManager.get(team.manager_id)
          return (
            <TeamBillingForm
              key={team.id}
              initial={{
                teamId: team.id,
                teamName: `${team.name} (${managerByIds.get(team.manager_id) ?? team.manager_id})`,
                minSeats: team.min_seats,
                cyclus: team.cyclus,
                volgendeFactuurdatum: team.volgende_factuurdatum,
                geblokkeerdAt: team.geblokkeerd_at,
                bedrijfsnaam: klant?.bedrijfsnaam ?? null,
                kvkNummer: klant?.kvk_nummer ?? null,
                btwNummer: klant?.btw_nummer ?? null,
                straat: klant?.straat ?? null,
                postcode: klant?.postcode ?? null,
                plaats: klant?.plaats ?? null,
              }}
            />
          )
        })}

        {(teams ?? []).map(team => {
          const facturen = facturenByTeam.get(team.id) ?? []
          if (!facturen.length) return null
          return (
            <div key={`${team.id}-facturen`} style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 12, letterSpacing: 1, color: '#6b7280', marginBottom: 6 }}>{team.name}, facturen</p>
              <table style={{ width: '100%', fontSize: 13, color: '#9ca3af', borderCollapse: 'collapse' }}>
                <tbody>
                  {facturen.map((f, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
                      <td style={{ padding: '4px 8px' }}>{new Date(f.created_at).toLocaleDateString('nl-NL')}</td>
                      <td style={{ padding: '4px 8px' }}>{f.soort}</td>
                      <td style={{ padding: '4px 8px' }}>{f.seats_aantal} seats</td>
                      <td style={{ padding: '4px 8px' }}>€{(f.bedrag_cent / 100).toFixed(2)}</td>
                      <td style={{ padding: '4px 8px', color: f.status === 'paid' ? '#22c55e' : f.status === 'open' ? '#f59e0b' : '#6b7280' }}>{f.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}

        <div style={{ marginTop: 40 }}>
          <p style={sectionLabel}>Recente aanvragen (/team, referentie)</p>
          <p style={{ ...muted, marginBottom: 12 }}>
            Ter info, niet automatisch gekoppeld: match zelf op e-mailadres met het team hierboven.
          </p>
          <table style={{ width: '100%', fontSize: 13, color: '#9ca3af', borderCollapse: 'collapse' }}>
            <tbody>
              {(openAanvragen ?? []).map((a, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
                  <td style={{ padding: '4px 8px' }}>{new Date(a.created_at).toLocaleDateString('nl-NL')}</td>
                  <td style={{ padding: '4px 8px' }}>{a.bedrijfsnaam}</td>
                  <td style={{ padding: '4px 8px' }}>{a.aanvrager_naam} ({a.email})</td>
                  <td style={{ padding: '4px 8px' }}>{a.aantal_seats} seats, {a.cyclus}</td>
                  <td style={{ padding: '4px 8px' }}>€{a.berekende_prijs_per_maand}/maand</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
