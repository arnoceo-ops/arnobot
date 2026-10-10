import { NextRequest, NextResponse } from 'next/server'
import { isAdminSession } from '@/lib/adminAuth'
import { getBlogDb, revalidateBlog, validatePostInput, type BlogPost } from '@/lib/blog'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Ctx = { params: Promise<{ id: string }> }

async function loadPost(id: string): Promise<BlogPost | null> {
  const { data } = await getBlogDb().from('arnobot_blog_posts').select('*').eq('id', id).maybeSingle()
  return (data as unknown as BlogPost) ?? null
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await isAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Ongeldig id' }, { status: 400 })

  const existing = await loadPost(id)
  if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = validatePostInput(body)
  if (!parsed.ok) return NextResponse.json({ errors: parsed.errors }, { status: 400 })
  const v = parsed.value

  // Een al gepubliceerde post houdt zijn publicatiedatum. Terug naar concept of inplannen
  // wist de datum, zodat opnieuw publiceren een nieuwe datum krijgt.
  const published_at =
    v.status === 'published' ? existing.published_at ?? new Date().toISOString() : null

  const { error } = await getBlogDb()
    .from('arnobot_blog_posts')
    .update({ ...v, published_at, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return NextResponse.json({ errors: ['Deze slug bestaat al.'] }, { status: 409 })
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }

  // Beide slugs verversen: bij een hernoemde slug moet de oude pagina verdwijnen.
  revalidateBlog(v.slug)
  if (existing.slug !== v.slug) revalidateBlog(existing.slug)
  return NextResponse.json({ ok: true, slug: v.slug, status: v.status })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  if (!(await isAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Ongeldig id' }, { status: 400 })

  const existing = await loadPost(id)
  if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  const { error } = await getBlogDb().from('arnobot_blog_posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })

  revalidateBlog(existing.slug)
  return NextResponse.json({ ok: true })
}
