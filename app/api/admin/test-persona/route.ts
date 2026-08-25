import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { MANUAL_TEST_USER_ID, TEST_TEAM_ID } from '@/lib/internalTestAccounts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Zet Arno's handmatige testaccount om naar één van vijf persona's, door de ECHTE
// onderliggende data te wijzigen (arnobot_team_members, command_manager, profiel.rol),
// niet via een query-param-bypass die op elke pagina apart zou moeten worden meegebouwd
// (zie docs/TEAM_PLAN.md, 2026-08-24). Elke pagina gedraagt zich daardoor exact zoals bij
// een echte gebruiker. Hardcoded naar MANUAL_TEST_USER_ID, accepteert nooit een andere
// userId, als veiligheidsrail tegen per ongeluk een echt account wijzigen.
const PERSONAS = ['verkoper', 'teammanager', 'teamlid', 'ceo', 'solopreneur'] as const
export type TestPersona = typeof PERSONAS[number]

const ROL_PER_PERSONA: Record<TestPersona, string> = {
  verkoper: 'AE Hunter',
  teammanager: 'Sales Director',
  teamlid: 'AE Hunter',
  ceo: 'CEO/DGA',
  solopreneur: 'Solopreneur',
}

function isAuthorized(token: string | undefined) {
  return !!token && token === process.env.ARNOBOT_ADMIN_KEY
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (!isAuthorized(cookieStore.get('arnobot_admin')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { persona } = await req.json()
  if (!PERSONAS.includes(persona)) {
    return NextResponse.json({ error: 'Ongeldige persona' }, { status: 400 })
  }

  const userId = MANUAL_TEST_USER_ID

  // Schone lei: één account kan maar bij één team/rol tegelijk horen (echte beperking
  // van het datamodel), dus eerst het bestaande lidmaatschap weg, daarna opnieuw
  // opbouwen voor de gekozen persona.
  await supabase.from('arnobot_team_members').delete().eq('user_id', userId)

  const commandManager = persona === 'teammanager'
  await supabase.from('approved_users').update({ command_manager: commandManager }).eq('user_id', userId)

  if (persona === 'teammanager') {
    await supabase.from('arnobot_team_members').insert({ team_id: TEST_TEAM_ID, user_id: userId, role: 'manager' })
  } else if (persona === 'teamlid') {
    await supabase.from('arnobot_team_members').insert({ team_id: TEST_TEAM_ID, user_id: userId, role: 'member' })
  }

  const { data: existing } = await supabase
    .from('arnobot_blog_profiles')
    .select('profiel')
    .eq('user_id', userId)
    .maybeSingle()

  const huidigProfiel = (existing?.profiel as Record<string, unknown>) ?? {}
  const nieuwProfiel = {
    ...huidigProfiel,
    rol: ROL_PER_PERSONA[persona as TestPersona],
    gebruik: persona === 'teammanager' ? 'team' : 'individueel',
  }

  const { error } = await supabase
    .from('arnobot_blog_profiles')
    .upsert({ user_id: userId, profiel: nieuwProfiel, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

  if (error) {
    console.error('test-persona upsert error:', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, persona })
}
