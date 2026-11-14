import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import AdminNav from '../AdminNav'
import TeamBillingForm from './TeamBillingForm'
import TeamProefVerleng from './TeamProefVerleng'
import { isAgentProef, proefEinde, proefStand, verlengStandaardDatum } from '@/lib/teamProef'
import { TEST_TEAM_ID, isFakeDemoUser, isInternalTestUser } from '@/lib/internalTestAccounts'
import { berekenTeamPrijsPerMaand } from '@/lib/teamPricing'
import { nlVandaag } from '@/lib/nlTijd'

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
    ? await supabase.from('approved_users').select('user_id, email, trial_start, expires_at, paid_at, sd_attribution_method').in('user_id', managerIds)
    : { data: [] }
  const managerByIds = new Map((managers ?? []).map(m => [m.user_id, m.email]))
  const managerRijen = new Map((managers ?? []).map(m => [m.user_id, m]))

  const { data: klanten } = managerIds.length
    ? await supabase.from('arnobot_billing_customers').select('*').in('user_id', managerIds)
    : { data: [] }
  const klantByManager = new Map((klanten ?? []).map(k => [k.user_id, k]))

  const { data: openAanvragen } = await supabase
    .from('arnobot_command_requests')
    .select('bedrijfsnaam, aanvrager_naam, email, aantal_seats, cyclus, berekende_prijs_per_maand, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  // De laatste 20 facturen per team. Eerder één globale .limit(50): zodra er meer teams en facturen
  // waren, verdwenen de oudere facturen van een team stilletjes uit de lijst.
  const facturenPerTeam = await Promise.all((teams ?? []).map(async t => {
    const { data } = await supabase
      .from('arnobot_team_facturen')
      .select('team_id, soort, seats_aantal, bedrag_cent, status, created_at')
      .eq('team_id', t.id)
      .order('created_at', { ascending: false })
      .limit(20)
    return [t.id, data ?? []] as const
  }))
  const facturenByTeam = new Map(facturenPerTeam)

  // Stand per team: echte leden (zonder test- en demo-accounts), de seats waarop gefactureerd wordt
  // (actueel ledenaantal, nooit onder het minimum), het bedrag van de volgende factuur en de dagen ernaartoe.
  const teamIds = (teams ?? []).map(t => t.id)
  const { data: ledenRijen } = teamIds.length
    ? await supabase.from('arnobot_team_members').select('team_id, user_id').in('team_id', teamIds)
    : { data: [] as { team_id: string; user_id: string }[] }
  const ledenPerTeam = new Map<string, number>()
  for (const l of ledenRijen ?? []) {
    if (isFakeDemoUser(l.user_id) || isInternalTestUser(l.user_id)) continue
    ledenPerTeam.set(l.team_id, (ledenPerTeam.get(l.team_id) ?? 0) + 1)
  }
  const vandaag = nlVandaag()
  function standVoor(team: { id: string; min_seats: number | null; cyclus: string | null; volgende_factuurdatum: string | null }) {
    const leden = ledenPerTeam.get(team.id) ?? 0
    if (team.min_seats == null) return { tekst: `${leden} leden, nog niet geactiveerd voor facturatie`, kleur: '#6b7280' }
    const cyclus = team.cyclus === 'jaarlijks' ? 'jaarlijks' : 'maandelijks'
    const seats = Math.max(leden, team.min_seats)
    const perMaand = berekenTeamPrijsPerMaand(seats, cyclus)
    const bedrag = perMaand === null ? 'bedrag onbekend' : `€${cyclus === 'jaarlijks' ? perMaand * 12 : perMaand} excl. btw per ${cyclus === 'jaarlijks' ? 'jaar' : 'maand'}`
    let factuur = 'volgende factuurdatum nog niet ingesteld'
    let kleur = '#9ca3af'
    if (team.volgende_factuurdatum) {
      const dagen = Math.round((Date.parse(team.volgende_factuurdatum.slice(0, 10)) - Date.parse(vandaag)) / 86_400_000)
      factuur = dagen < 0 ? `volgende factuur ${Math.abs(dagen)} dagen te laat (${team.volgende_factuurdatum.slice(0, 10)})` : `volgende factuur ${team.volgende_factuurdatum.slice(0, 10)}, over ${dagen} dag${dagen === 1 ? '' : 'en'}`
      kleur = dagen < 0 ? '#ef4444' : dagen < 7 ? '#f59e0b' : '#9ca3af'
    }
    return { tekst: `${leden} leden${leden < team.min_seats ? ` (minimum ${team.min_seats})` : ''}, gefactureerd op ${seats} seats, ${bedrag}, ${factuur}`, kleur }
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
          const stand = standVoor(team)
          // Gratis agent-proef (lib/teamProef.ts): einde, resterende dagen en handmatig verlengen.
          const proefManager = managerRijen.get(team.manager_id)
          const proefEindDatum = proefManager && isAgentProef(proefManager, team.min_seats) ? proefEinde(proefManager) : null
          const proef = proefEindDatum ? proefStand(proefEindDatum) : null
          const proefTekst = !proefEindDatum || !proef ? null
            : proef.staat === 'verlopen'
              ? `Gratis agent-proef afgelopen op ${proefEindDatum.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' })}${team.geblokkeerd_at ? ', team geblokkeerd' : ''}`
              : `Gratis agent-proef t/m ${proefEindDatum.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' })}, nog ${proef.dagen} dag${proef.dagen === 1 ? '' : 'en'}`
          const verlengVanaf = verlengStandaardDatum(proefEindDatum)
          return (
            <div key={team.id}>
              <p style={{ fontSize: 13, color: stand.kleur, margin: '0 0 6px 2px' }}>{stand.tekst}</p>
              {proefTekst && proef && (
                <>
                  <p style={{ fontSize: 13, color: proef.staat === 'verlopen' ? '#ef4444' : proef.staat === 'bijna' ? '#f59e0b' : '#9ca3af', margin: '0 0 6px 2px' }}>{proefTekst}</p>
                  <TeamProefVerleng teamId={team.id} standaardDatum={verlengVanaf} />
                </>
              )}
            <TeamBillingForm
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
            </div>
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
