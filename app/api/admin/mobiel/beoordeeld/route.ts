import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { controleerMobielToegang } from '@/lib/adminMobiel'

// Markeert een gemarkeerd off-topic-bericht als beoordeeld, vanaf de telefoonpagina (/bot/admin/mobiel).
// Eigen route met de Clerk-toegangscontrole van die pagina: de pc-route (/api/admin/offtopic-flags) werkt
// met het oude admin-wachtwoord en is voor de telefoon niet bereikbaar.
export async function POST(req: NextRequest) {
  const toegang = await controleerMobielToegang()
  if (!toegang.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const id = body?.id
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { error } = await supabase.from('arnobot_offtopic_flags').update({ reviewed: true }).eq('id', id)
  if (error) {
    console.error('[admin/mobiel] beoordeeld opslaan mislukt:', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
