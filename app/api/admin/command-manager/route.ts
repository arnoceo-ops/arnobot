import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { adminKeyMatches } from '@/lib/adminAuth'
import { logAdminActie } from '@/lib/adminLog'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!adminKeyMatches(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { userId, commandManager } = body
  if (!userId || typeof commandManager !== 'boolean') {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  const { data: oud } = await supabase.from('approved_users').select('command_manager').eq('user_id', userId).maybeSingle()

  const { error } = await supabase
    .from('approved_users')
    .update({ command_manager: commandManager })
    .eq('user_id', userId)

  if (error) {
    console.error('Command manager update error:', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
  await logAdminActie({ actie: 'teamrol_gewijzigd', doelUserId: userId, details: { oud: { command_manager: oud?.command_manager ?? null }, nieuw: { command_manager: commandManager } } })
  return NextResponse.json({ ok: true })
}
