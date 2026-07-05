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
    .limit(5)

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

  // Blokkeer als er al een analyse is van minder dan 7 dagen oud
  const { data: recent } = await supabase
    .from('arnobot_team_analyses')
    .select('created_at')
    .eq('team_id', managerMember.team_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recent) {
    const dagenOud = (Date.now() - new Date(recent.created_at).getTime()) / 86400000
    if (dagenOud < 7) {
      const dagenRest = Math.ceil(7 - dagenOud)
      return NextResponse.json(
        { error: `Er is al een analyse van deze week. Probeer het over ${dagenRest} ${dagenRest === 1 ? 'dag' : 'dagen'} opnieuw.` },
        { status: 429 }
      )
    }
  }

  const { data: members } = await supabase
    .from('arnobot_team_members')
    .select('user_id')
    .eq('team_id', managerMember.team_id)

  if (!members?.length) return NextResponse.json({ error: 'Geen teamleden' }, { status: 400 })

  const memberIds = members.map(m => m.user_id)

  const [sessionsRes, scoresRes] = await Promise.all([
    supabase
      .from('arnobot_blog_sessions')
      .select('user_id, summary, feiten')
      .in('user_id', memberIds)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('arnobot_coaching_scores')
      .select('mindset_score, systeem_score, actie_score, created_at')
      .in('user_id', memberIds)
      .order('created_at', { ascending: true })
      .limit(300),
  ])

  if (!sessionsRes.data?.length) return NextResponse.json({ error: 'Niet genoeg data voor een team-analyse' }, { status: 400 })

  const teamData = sessionsRes.data
    .filter(s => s.summary)
    .map(s => `- ${s.summary}${s.feiten ? '\n  Feiten: ' + s.feiten.slice(0, 200) : ''}`)
    .join('\n\n')
    .slice(0, 6000)

  // Bereken maandgemiddelden uit historische scores
  const byMonth: Record<string, { mindset: number[]; systeem: number[]; actie: number[] }> = {}
  for (const s of scoresRes.data ?? []) {
    const month = s.created_at.slice(0, 7)
    if (!byMonth[month]) byMonth[month] = { mindset: [], systeem: [], actie: [] }
    if (s.mindset_score) byMonth[month].mindset.push(s.mindset_score)
    if (s.systeem_score) byMonth[month].systeem.push(s.systeem_score)
    if (s.actie_score) byMonth[month].actie.push(s.actie_score)
  }
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null
  const maanden = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  const trendRegels = Object.entries(byMonth)
    .slice(-6)
    .map(([month, d]) => {
      const m = avg(d.mindset), s = avg(d.systeem), a = avg(d.actie)
      const label = `${maanden[parseInt(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
      return `${label}: Mindset ${m ?? '?'} / Systeem ${s ?? '?'} / Actie ${a ?? '?'}`
    })
    .join('\n')

  const trendContext = trendRegels ? `\n\nTEAMSCORES OVER TIJD (gemiddeld per maand):\n${trendRegels}` : ''

  const result = await anthropic.messages.create({
    model: 'claude-sonnet-5',
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
Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst.
Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`,
    messages: [{
      role: 'user',
      content: `Schrijf een teamanalyse voor de manager van team "${team.name}" op basis van de gesprekssamenvatingen en scoreontwikkeling van zijn teamleden.

GESPREKKEN:
${teamData}${trendContext}`
    }]
  })

  const analyse = getText(result.content)

  await supabase
    .from('arnobot_team_analyses')
    .insert({ team_id: managerMember.team_id, analyse_text: analyse })

  // Houd maximaal 5 analyses per team — verwijder de oudste
  const { data: all } = await supabase
    .from('arnobot_team_analyses')
    .select('id')
    .eq('team_id', managerMember.team_id)
    .order('created_at', { ascending: false })

  if (all && all.length > 5) {
    const toDelete = all.slice(5).map(r => r.id)
    await supabase.from('arnobot_team_analyses').delete().in('id', toDelete)
  }

  return NextResponse.json({ analyse })
}
