export const maxDuration = 30

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ analyses: [] })

  const { data: analyses } = await supabase
    .from('arnobot_team_analyses')
    .select('id, analyse_text, created_at')
    .eq('team_id', managerMember.team_id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ analyses: analyses ?? [] })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id, arnobot_teams(name)')
    .eq('user_id', userId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ error: 'Geen manager-toegang' }, { status: 403 })

  const team = managerMember.arnobot_teams as unknown as { name: string }

  const { data: members } = await supabase
    .from('arnobot_team_members')
    .select('user_id')
    .eq('team_id', managerMember.team_id)

  if (!members?.length) return NextResponse.json({ error: 'Geen teamleden' }, { status: 400 })

  const memberIds = members.map(m => m.user_id)

  const { data: sessions } = await supabase
    .from('arnobot_blog_sessions')
    .select('user_id, summary, feiten')
    .in('user_id', memberIds)
    .order('created_at', { ascending: false })
    .limit(40)

  if (!sessions?.length) return NextResponse.json({ error: 'Niet genoeg data voor een team-analyse' }, { status: 400 })

  const teamData = sessions
    .filter(s => s.summary)
    .map(s => `- ${s.summary}${s.feiten ? '\n  Feiten: ' + s.feiten.slice(0, 200) : ''}`)
    .join('\n\n')
    .slice(0, 6000)

  const result = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: `Je bent Arno Diepeveen, salescoach met 40 jaar ervaring. Direct, eerlijk, maar altijd gericht op groei.
Je schrijft een teamanalyse voor de manager. Toon: motiverend én scherp. Geen lofzang, geen afbranden.
Begin DIRECT met de eerste sectiekop. Geen documenttitel, geen teamnaam, geen inleiding bovenaan.
Structuur (gebruik deze vaste opbouw, zonder markdown headers):

KRACHT VAN HET TEAM
Wat doet dit team collectief goed? Waar zit echte potentie? Wees specifiek.

GROEIKANS
Één patroon dat het team collectief terughoudt. Benoem het helder, zonder te veroordelen.

ARNO'S ADVIES
Één concrete actie die de manager deze week kan inzetten. Praktisch, uitvoerbaar, direct.

Maximaal 250 woorden totaal. Schrijf in eerste persoon, alsof je de manager persoonlijk aanspreekt.
Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`,
    messages: [{
      role: 'user',
      content: `Schrijf een teamanalyse voor de manager van team "${team.name}" op basis van deze gesprekssamengevattingen van zijn teamleden met ArnoBot.

GESPREKKEN:
${teamData}`
    }]
  })

  const analyse = getText(result.content)

  await supabase
    .from('arnobot_team_analyses')
    .insert({ team_id: managerMember.team_id, analyse_text: analyse })

  return NextResponse.json({ analyse })
}
