import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TEST_TEAM_ID } from '@/lib/internalTestAccounts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { userId: managerId } = await auth()
  if (!managerId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { targetUserId, aandachtspunt, notitie, agenda, actie } = await req.json()
  if (!targetUserId) return NextResponse.json({ error: 'Geen userId' }, { status: 400 })

  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', managerId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ error: 'Geen manager-toegang' }, { status: 403 })

  const { data: targetMember } = await supabase
    .from('arnobot_team_members')
    .select('role')
    .eq('user_id', targetUserId)
    .eq('team_id', managerMember.team_id)
    .single()

  if (!targetMember) return NextResponse.json({ error: 'Lid niet gevonden' }, { status: 404 })

  const { data: coaching } = await supabase
    .from('arnobot_coaching')
    .select('mindset_score, systeem_score, actie_score')
    .eq('user_id', targetUserId)
    .maybeSingle()

  const today = new Date().toISOString().slice(0, 10)
  const { data: existing } = await supabase
    .from('arnobot_1on1_log')
    .select('id, agenda, aandachtspunt')
    .eq('manager_id', managerId)
    .eq('member_id', targetUserId)
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`)
    .maybeSingle()

  const payload = {
    mindset_score: coaching?.mindset_score ?? null,
    systeem_score: coaching?.systeem_score ?? null,
    actie_score: coaching?.actie_score ?? null,
    aandachtspunt: aandachtspunt || null,
    notitie: notitie || null,
    agenda: agenda || null,
    actie: actie || null,
  }

  // Testteam: nieuwe 1:1's mogen tijdens een demo/test wel doorlopen, maar worden bewust niet
  // opgeslagen, zodat de gecureerde testdata niet bij elke demo verder wegdrift. Alleen al
  // bestaande entries (van vandaag, hierboven opgezocht) blijven overschrijfbaar, dat is
  // bijwerken van iets dat al stond, geen nieuwe permanente aanwas.
  if (managerMember.team_id === TEST_TEAM_ID && !existing) {
    return NextResponse.json({ ok: true, saved: false })
  }

  // Deze route wordt ook aangeroepen om alleen actie/notitie bij te werken op een rij die
  // vandaag al een agenda heeft (debounced auto-save tijdens typen, onBlur, pagehide-beacon).
  // Als zo'n aanroep toevallig met een lege/verse React-state uitgevoerd wordt (bv. na een
  // page-reload, of terwijl een mislukte regeneratie de lokale state net gewist had), mag een
  // leeg agenda/aandachtspunt-veld de al opgeslagen inhoud van een BESTAANDE rij nooit
  // overschrijven met null. Alleen bij een echte nieuwe rij (insert) is null legitiem, er is
  // dan niets te verliezen.
  const updatePayload = existing
    ? {
        ...payload,
        agenda: agenda || existing.agenda,
        aandachtspunt: aandachtspunt || existing.aandachtspunt,
      }
    : payload

  const { error } = existing
    ? await supabase.from('arnobot_1on1_log').update(updatePayload).eq('id', existing.id)
    : await supabase.from('arnobot_1on1_log').insert({ ...payload, manager_id: managerId, member_id: targetUserId, team_id: managerMember.team_id })

  if (error) {
    console.error('1on1 save error:', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, saved: true })
}
