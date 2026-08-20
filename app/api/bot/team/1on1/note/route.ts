import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(req: NextRequest) {
  const { userId: managerId } = await auth()
  if (!managerId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { logId, notitie, actie_status } = await req.json()
  if (!logId) return NextResponse.json({ error: 'Geen logId' }, { status: 400 })
  if (actie_status !== undefined && !['ja', 'nee', 'skip'].includes(actie_status)) {
    return NextResponse.json({ error: 'Ongeldige actie_status' }, { status: 400 })
  }

  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', managerId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ error: 'Geen manager-toegang' }, { status: 403 })

  const update: { notitie?: string | null; actie_status?: string } = {}
  if (notitie !== undefined) update.notitie = typeof notitie === 'string' ? notitie.trim() || null : null
  if (actie_status !== undefined) update.actie_status = actie_status

  const { error } = await supabase
    .from('arnobot_1on1_log')
    .update(update)
    .eq('id', logId)
    .eq('manager_id', managerId)

  if (error) return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
