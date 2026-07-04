import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ scores: [] })

  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id, arnobot_teams(id)')
    .eq('user_id', userId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ scores: [] })

  const team = managerMember.arnobot_teams as unknown as { id: string }

  const { data: members } = await supabase
    .from('arnobot_team_members')
    .select('user_id')
    .eq('team_id', team.id)
    .neq('role', 'manager')

  if (!members?.length) return NextResponse.json({ scores: [] })

  const memberIds = members.map(m => m.user_id)

  const { data: raw } = await supabase
    .from('arnobot_coaching_scores')
    .select('mindset_score, systeem_score, actie_score, created_at')
    .in('user_id', memberIds)
    .order('created_at', { ascending: true })
    .limit(300)

  if (!raw?.length) return NextResponse.json({ scores: [] })

  // Groepeer per dag en bereken gemiddelden
  const byDay: Record<string, { mindset: number[]; systeem: number[]; actie: number[] }> = {}
  for (const s of raw) {
    const day = s.created_at.slice(0, 10)
    if (!byDay[day]) byDay[day] = { mindset: [], systeem: [], actie: [] }
    byDay[day].mindset.push(s.mindset_score)
    byDay[day].systeem.push(s.systeem_score)
    byDay[day].actie.push(s.actie_score)
  }

  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10

  const scores = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-20) // max 20 datapunten
    .map(([day, d]) => ({
      created_at: day + 'T12:00:00Z',
      mindset_score: avg(d.mindset),
      systeem_score: avg(d.systeem),
      actie_score:   avg(d.actie),
    }))

  return NextResponse.json({ scores })
}
