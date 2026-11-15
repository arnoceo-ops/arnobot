import { createClient } from '@supabase/supabase-js'
import { MANUAL_TEST_USER_ID, TEST_PROEF_TEAM_ID, TEST_TEAM_ID } from '@/lib/internalTestAccounts'
import { proefEinde, proefStand } from '@/lib/teamProef'

// Testknoppen TEAMPROEF op /bot/admin/gebruikers: zet het handmatige testaccount (test@arno.bot) in een
// echte agent-proef, in een eigen testteam (nooit Team Apex, anders raakt een blokkade ook Thijs). Net als
// de persona-knoppen verandert dit de ECHTE data, zodat elke pagina zich gedraagt als bij een echte manager.
// De oorspronkelijke waarden van het account worden bewaard en komen terug met UIT of een persona-knop.

// betaald40 en betaald10: een betaald team met facturatie, waarvan de lopende periode over 40 of over 10 dagen eindigt. Om de
// opzegregel te zien (docs/TEAM_PROCES.md, fase 6): bij 40 dagen is opzeggen op tijd (einde van de periode), bij 10 dagen te laat
// (een periode later). De cron stopt een testteam nooit, dus het echte stoppen op de einddatum is alleen met tests gedekt.
export type TeamproefStand = 'lopend' | 'bijna' | 'coulance' | 'voorbij' | 'betaald40' | 'betaald10'
export type TeamproefHuidig = TeamproefStand | 'geactiveerd' | 'uit'

const SLEUTEL = 'test_teamproef_backup'
const DAG = 86_400_000
// Dagen geleden dat de proef begon, bij een proef van 30 dagen.
// coulance: de 30 dagen waren 3 dagen geleden om, nog 7 dagen toegang. voorbij: ook de coulance van 10 dagen is op.
const START_DAGEN_GELEDEN: Record<TeamproefStand, number> = { lopend: 10, bijna: 27, coulance: 33, voorbij: 41, betaald40: 60, betaald10: 60 }

type Backup = { expires_at: string | null; paid_at: string | null; trial_start: string | null; sd_attribution_method: string | null; command_manager: boolean | null; plan?: string | null }

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function leesBackup(): Promise<Backup | null> {
  const { data } = await db().from('arnobot_meta').select('value').eq('key', SLEUTEL).maybeSingle<{ value: string }>()
  if (!data?.value) return null
  try { return JSON.parse(data.value) as Backup } catch { return null }
}

/** Bepaalt in welke stand het testaccount nu staat, voor de gemarkeerde knop. */
export async function huidigeTeamproef(): Promise<TeamproefHuidig> {
  if (!(await leesBackup())) return 'uit'
  const supabase = db()
  const { data: team } = await supabase.from('arnobot_teams').select('min_seats, geblokkeerd_at, volgende_factuurdatum').eq('id', TEST_PROEF_TEAM_ID).maybeSingle<{ min_seats: number | null; geblokkeerd_at: string | null; volgende_factuurdatum: string | null }>()
  if (!team) return 'uit'
  if (team.min_seats !== null) {
    const dagenTotEinde = team.volgende_factuurdatum ? Math.round((new Date(`${team.volgende_factuurdatum}T12:00:00Z`).getTime() - Date.now()) / DAG) : null
    if (dagenTotEinde !== null && dagenTotEinde >= 35) return 'betaald40'
    if (dagenTotEinde !== null && dagenTotEinde >= 5 && dagenTotEinde <= 15) return 'betaald10'
    return 'geactiveerd'
  }
  if (team.geblokkeerd_at) return 'voorbij'
  const { data: u } = await supabase.from('approved_users').select('trial_start').eq('user_id', MANUAL_TEST_USER_ID).maybeSingle<{ trial_start: string | null }>()
  const einde = proefEinde({ trial_start: u?.trial_start ?? null, expires_at: null, paid_at: null, sd_attribution_method: 'link' })
  const staat = einde ? proefStand(einde).staat : 'lopend'
  return staat === 'verlopen' ? 'voorbij' : staat === 'bijna' ? 'bijna' : staat === 'coulance' ? 'coulance' : 'lopend'
}

/** Zet het testaccount als manager in een agent-proef in de gevraagde stand. Alles van een eerdere testronde wordt eerst gewist. */
export async function zetTeamproef(stand: TeamproefStand): Promise<void> {
  const supabase = db()
  const userId = MANUAL_TEST_USER_ID

  if (!(await leesBackup())) {
    const { data: u } = await supabase.from('approved_users').select('expires_at, paid_at, trial_start, sd_attribution_method, command_manager, plan').eq('user_id', userId).maybeSingle<Backup>()
    if (!u) throw new Error('testaccount niet gevonden')
    const { error } = await supabase.from('arnobot_meta').upsert({ key: SLEUTEL, value: JSON.stringify(u) }, { onConflict: 'key' })
    if (error) throw new Error(`backup opslaan mislukt: ${error.message}`)
  }

  await supabase.from('arnobot_team_members').delete().eq('user_id', userId)
  await supabase.from('arnobot_team_facturen').delete().eq('team_id', TEST_PROEF_TEAM_ID)
  const voorbij = stand === 'voorbij' // pas na de coulance is het team geblokkeerd
  const betaald = stand === 'betaald40' || stand === 'betaald10'
  const eindeperiode = betaald ? new Date(Date.now() + (stand === 'betaald40' ? 40 : 10) * DAG).toISOString().slice(0, 10) : null
  const { error: teamFout } = await supabase.from('arnobot_teams').upsert(
    { id: TEST_PROEF_TEAM_ID, name: 'Proefteam (test)', manager_id: userId, niveau: 'premium', min_seats: betaald ? 3 : null, cyclus: betaald ? 'maandelijks' : null, volgende_factuurdatum: eindeperiode, geblokkeerd_at: voorbij ? new Date().toISOString() : null, stopt_op: null },
    { onConflict: 'id' },
  )
  if (teamFout) throw new Error(`testteam aanmaken mislukt: ${teamFout.message}`)
  await supabase.from('arnobot_team_members').insert({ team_id: TEST_PROEF_TEAM_ID, user_id: userId, role: 'manager' })

  const { error } = await supabase.from('approved_users').update({
    command_manager: true,
    sd_attribution_method: 'link',
    // Zoals een echte agent-proef: een nieuw account begint op Pro (proxy.ts), nooit op Basic.
    plan: 'premium',
    paid_at: null,
    expires_at: null,
    trial_start: new Date(Date.now() - START_DAGEN_GELEDEN[stand] * DAG).toISOString(),
  }).eq('user_id', userId)
  if (error) throw new Error(`testaccount zetten mislukt: ${error.message}`)

  const { data: p } = await supabase.from('arnobot_blog_profiles').select('profiel').eq('user_id', userId).maybeSingle<{ profiel: Record<string, unknown> | null }>()
  await supabase.from('arnobot_blog_profiles').upsert({ user_id: userId, profiel: { ...(p?.profiel ?? {}), rol: 'Sales Director', gebruik: 'team' }, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
}

/**
 * Zet het testaccount terug zoals het was vóór de teamproef-knoppen, als manager van Team Apex, en ruimt het
 * testteam met zijn facturen op. Doet niets als er geen teamproef actief is (dus veilig bij elke persona-knop).
 */
export async function herstelTestaccount(): Promise<boolean> {
  const backup = await leesBackup()
  if (!backup) return false
  const supabase = db()
  const userId = MANUAL_TEST_USER_ID

  const { error } = await supabase.from('approved_users').update(backup).eq('user_id', userId)
  if (error) throw new Error(`testaccount terugzetten mislukt: ${error.message}`)
  await supabase.from('arnobot_team_members').delete().eq('user_id', userId)
  await supabase.from('arnobot_team_facturen').delete().eq('team_id', TEST_PROEF_TEAM_ID)
  await supabase.from('arnobot_teams').delete().eq('id', TEST_PROEF_TEAM_ID)
  await supabase.from('arnobot_team_members').insert({ team_id: TEST_TEAM_ID, user_id: userId, role: 'manager' })
  await supabase.from('arnobot_meta').delete().eq('key', SLEUTEL)
  return true
}
