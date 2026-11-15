import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clearIndividueelGebruik } from '@/lib/teamAccess'
import { nieuwMelden } from '@/lib/capaciteit'
import { stopSoloBijJoin } from '@/lib/billing/teamlidSolo'
import { notifyTelegram } from '@/lib/cron-notify'
import { TEST_TEAM_IDS } from '@/lib/internalTestAccounts'

// Maximaal aantal leden per team, en vanaf hoeveel leden Arno een melding krijgt (een groter team vraagt een aanpassing, zie docs/TEAM_PROCES.md).
const MAX_LEDEN = 25
const MELD_VANAF_LEDEN = 20

// Een team dat geblokkeerd is of is opgezegd (stopt binnenkort) kan niet meer worden gejoind. Anders verliest het nieuwe lid zijn
// eigen abonnement en proef (stopSoloBijJoin) en belandt hij in een team dat hem buitensluit of binnenkort stopt.
const NIET_ACTIEF = 'Dit team is niet actief, daarom kun je er nu niet bij. Neem contact op met je teammanager.'
const teamIsActief = (t: { geblokkeerd_at?: string | null; stopt_op?: string | null }) => !t.geblokkeerd_at && !t.stopt_op

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Telegram naar Arno als een team tegen de grens aan loopt (eenmalig vanaf 20 leden) of als iemand wordt geweigerd omdat het
 * team vol is (hooguit één keer per week per team). Een mislukte melding mag het joinen nooit blokkeren. Testteams tellen niet.
 */
async function meldTeamGrens(team: { id: string; name: string }, soort: 'bijna' | 'vol', leden: number) {
  if ((TEST_TEAM_IDS as readonly string[]).includes(team.id)) return
  try {
    const sleutel = soort === 'bijna' ? `teamgrens:bijna:${team.id}` : `teamgrens:vol:${team.id}`
    if (!(await nieuwMelden(sleutel, soort === 'bijna' ? 'mijlpaal' : 'waarschuwing'))) return
    await notifyTelegram(soort === 'bijna'
      ? `Team "${team.name}" heeft nu ${leden} van maximaal ${MAX_LEDEN} leden. Een groter team vraagt een aanpassing van de grens.`
      : `Iemand kon niet joinen: team "${team.name}" is vol (${MAX_LEDEN} leden). Pas de grens aan als dit team door moet groeien.`)
  } catch {
    // melding is bijzaak
  }
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { invite_code } = await req.json()
  if (!invite_code) return NextResponse.json({ error: 'Geen uitnodigingscode' }, { status: 400 })

  const { data: existing } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', userId)
    .single()

  if (existing) return NextResponse.json({ error: 'Je bent al lid van een team' }, { status: 400 })

  const { data: team } = await supabase
    .from('arnobot_teams')
    .select('id, name, niveau, geblokkeerd_at, stopt_op')
    .eq('invite_code', invite_code)
    .single()

  if (!team) return NextResponse.json({ error: 'Ongeldige uitnodigingscode' }, { status: 404 })
  if (!teamIsActief(team)) return NextResponse.json({ error: NIET_ACTIEF }, { status: 409 })

  const { count: memberCount } = await supabase
    .from('arnobot_team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', team.id)

  if ((memberCount ?? 0) >= MAX_LEDEN) {
    await meldTeamGrens(team, 'vol', memberCount ?? MAX_LEDEN)
    return NextResponse.json({ error: `Team is vol (maximaal ${MAX_LEDEN} leden)` }, { status: 400 })
  }

  const { error } = await supabase
    .from('arnobot_team_members')
    .insert({ team_id: team.id, user_id: userId, role: 'member' })

  if (error) return NextResponse.json({ error: 'Joinen mislukt' }, { status: 500 })

  if ((memberCount ?? 0) + 1 >= MELD_VANAF_LEDEN) await meldTeamGrens(team, 'bijna', (memberCount ?? 0) + 1)

  // Teamlid krijgt het niveau van het team (premium of elite), zodat iedereen
  // in een Command-deal daadwerkelijk het niveau krijgt waarvoor betaald is.
  if (team.niveau === 'premium' || team.niveau === 'elite') {
    await supabase
      .from('approved_users')
      .update({ plan: team.niveau })
      .eq('user_id', userId)
  }

  // Vanaf nu betaalt het team: een eigen abonnement stopt (betaalperiode loopt uit, geen restitutie) en een lopende proef
  // vervalt. Gooit nooit een fout door, joinen mag hier niet op mislukken. Zie docs/TEAM_PROCES.md.
  await stopSoloBijJoin(userId, team.name)

  // Een al ingelogde bestaande gebruiker (was al individuele Basic/Pro-klant) kan hier
  // rechtstreeks joinen zonder opnieuw aan te melden, zie app/bot/team/join/page.tsx. Zijn
  // profiel kan dan nog een 'individueel'-antwoord bevatten van vóór het joinen, dat anders
  // isConfirmedTeambaas/team/status voor altijd zou blijven saboteren.
  await clearIndividueelGebruik(userId)

  return NextResponse.json({ team })
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Geen code' }, { status: 400 })

  const { data: team } = await supabase
    .from('arnobot_teams')
    .select('name, geblokkeerd_at, stopt_op')
    .eq('invite_code', code)
    .single()

  if (!team) return NextResponse.json({ error: 'Ongeldig' }, { status: 404 })
  // De pagina toont dan meteen dat het team niet actief is, vóór iemand de uitleg leest en op joinen klikt.
  if (!teamIsActief(team)) return NextResponse.json({ teamName: team.name, nietActief: true, error: NIET_ACTIEF })
  return NextResponse.json({ teamName: team.name })
}
