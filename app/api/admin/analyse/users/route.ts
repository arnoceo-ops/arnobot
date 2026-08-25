import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  return token === process.env.ARNOBOT_ADMIN_KEY
}

// Lichte lijst voor het zoekveld op de ANALYSE-tab, los van de volle gebruikerslijst-query
// in app/bot/admin/gebruikers/page.tsx (die haalt ook activiteit/gezondheidsscore op, hier
// is alleen naam/e-mail nodig om iemand te kunnen opzoeken).
export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('approved_users')
    .select('user_id, email, full_name, voornaam, achternaam')
    .order('full_name', { ascending: true })

  const users = (data ?? []).map(u => ({
    userId: u.user_id,
    naam: u.full_name || [u.voornaam, u.achternaam].filter(Boolean).join(' ') || u.email || 'Onbekend',
    email: u.email as string | null,
  }))

  return NextResponse.json({ users })
}
