import { NextRequest, NextResponse } from 'next/server'
import { isAdminSession } from '@/lib/adminAuth'
import { getBlogDb } from '@/lib/blog'

const MAX_LIMIT = 100

// Admin: een pagina blogabonnees, nieuwste aanmelding eerst. Voedt de lijst "Laatste aanmeldingen"
// in de blogstatistieken (knop voor de volgende 50). Volgorde op created_at met id als
// tiebreaker, zodat pagina's elkaar niet overlappen of overslaan bij gelijke tijdstippen.
export async function GET(req: NextRequest) {
  if (!(await isAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const offset = Math.max(0, Number.parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10) || 0)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10) || 50))

  const { data, count, error } = await getBlogDb()
    .from('arnobot_blog_subscribers')
    .select('id, email, voornaam, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })

  return NextResponse.json({ rows: data ?? [], total: count ?? 0 })
}
