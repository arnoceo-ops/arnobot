import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// arnobot_meta_input is een generieke sleutel/waarde-tabel (key, value, updated_at),
// geen log met een rij per opslag. Deze ene sleutel bevat Arno's meest recente
// aantekeningen voor het jurypanel, een nieuwe opslag overschrijft de vorige.
const META_INPUT_KEY = 'panel_input'

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  return token === process.env.ARNOBOT_ADMIN_KEY
}

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data } = await supabase
    .from('arnobot_meta_input')
    .select('key, value, updated_at')
    .eq('key', META_INPUT_KEY)
    .maybeSingle()

  if (!data) return NextResponse.json(null)
  return NextResponse.json({ id: data.key, created_at: data.updated_at, content: data.value })
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { content } = await req.json()
  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Geen inhoud' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { data: existing } = await supabase
    .from('arnobot_meta_input')
    .select('key')
    .eq('key', META_INPUT_KEY)
    .maybeSingle()

  const { error } = existing
    ? await supabase
        .from('arnobot_meta_input')
        .update({ value: content.trim(), updated_at: now })
        .eq('key', META_INPUT_KEY)
    : await supabase
        .from('arnobot_meta_input')
        .insert({ key: META_INPUT_KEY, value: content.trim(), updated_at: now })

  if (error) {
    console.error('[admin/meta-input]', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: META_INPUT_KEY, created_at: now })
}
