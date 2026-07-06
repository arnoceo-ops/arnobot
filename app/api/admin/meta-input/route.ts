import { NextRequest, NextResponse } from 'next/server'
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

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data } = await supabase
    .from('arnobot_meta_input')
    .select('id, created_at, content')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json(data ?? null)
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { content } = await req.json()
  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Geen inhoud' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('arnobot_meta_input')
    .insert({ content: content.trim() })
    .select('id, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id, created_at: data.created_at })
}
