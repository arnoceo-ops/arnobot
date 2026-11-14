import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { adminKeyMatches } from '@/lib/adminAuth'
import { logAdminActie } from '@/lib/adminLog'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_AGENTS = ['sales_agent_1', 'sales_agent_2']
const VALID_METHODS = ['manual']

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!adminKeyMatches(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { userId, sdAgent, sdAttributionMethod } = body
  if (!userId) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  // Leeg maken (sdAgent = null) is altijd toegestaan, dat is de "geen"-optie.
  if (sdAgent !== null) {
    if (!VALID_AGENTS.includes(sdAgent) || !VALID_METHODS.includes(sdAttributionMethod)) {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
    }
  }

  const { data: oud } = await supabase.from('approved_users').select('sd_agent, sd_attribution_method').eq('user_id', userId).maybeSingle()
  const nieuweMethode = sdAgent === null ? null : sdAttributionMethod

  const { error } = await supabase
    .from('approved_users')
    .update({
      sd_agent: sdAgent,
      sd_attribution_method: nieuweMethode,
    })
    .eq('user_id', userId)

  if (error) {
    console.error('SD agent update error:', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
  await logAdminActie({
    actie: 'sd_agent_gewijzigd', doelUserId: userId,
    details: {
      oud: { sd_agent: oud?.sd_agent ?? null, sd_attribution_method: oud?.sd_attribution_method ?? null },
      nieuw: { sd_agent: sdAgent, sd_attribution_method: nieuweMethode },
    },
  })
  return NextResponse.json({ ok: true })
}
