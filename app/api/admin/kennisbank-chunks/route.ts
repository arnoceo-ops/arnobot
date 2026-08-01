import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Geen url opgegeven' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('blog_chunks')
    .select('id, content, context')
    .eq('url', url)
    .order('id', { ascending: true })

  if (error) {
    console.error('[admin/kennisbank-chunks GET]', error.message)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
  return NextResponse.json({ chunks: data ?? [] })
}

export async function DELETE(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Geen id opgegeven' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase.from('blog_chunks').delete().eq('id', id)
  if (error) {
    console.error('[admin/kennisbank-chunks DELETE]', error.message)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
