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

  const { data: chunk, error: fetchError } = await supabase
    .from('blog_chunks')
    .select('url')
    .eq('id', id)
    .maybeSingle()
  if (fetchError) {
    console.error('[admin/kennisbank-chunks DELETE fetch]', fetchError.message)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }

  const { error } = await supabase.from('blog_chunks').delete().eq('id', id)
  if (error) {
    console.error('[admin/kennisbank-chunks DELETE]', error.message)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }

  // Was dit de laatste chunk van deze url? Zonder deze markering ziet de wekelijkse
  // RSS-ingest cron (app/api/cron/rss-ingest/route.ts) een lege url als "nog nooit
  // verwerkt" en indexeert hij het artikel automatisch opnieuw, inclusief precies de
  // content die hier bewust verwijderd werd.
  if (chunk?.url) {
    const { count } = await supabase
      .from('blog_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('url', chunk.url)
    if (!count) {
      const { error: excludeError } = await supabase
        .from('arnobot_kb_excluded_urls')
        .upsert({ url: chunk.url }, { onConflict: 'url' })
      if (excludeError) {
        console.error('[admin/kennisbank-chunks DELETE exclude]', excludeError.message)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
