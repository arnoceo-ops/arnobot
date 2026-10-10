import { NextRequest, NextResponse } from 'next/server'
import { isAdminSession } from '@/lib/adminAuth'
import { getBlogDb, type BlogPost } from '@/lib/blog'
import { sendBlogTestMail } from '@/lib/blogMail'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TEST_TO = 'arno@arno.bot'

// Stuurt de nieuw-artikel-mail van een opgeslagen post naar jezelf, vóór er echte abonnees
// mail krijgen.
export async function POST(req: NextRequest) {
  if (!(await isAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { id?: unknown } | null
  if (!body || typeof body.id !== 'string' || !UUID.test(body.id)) {
    return NextResponse.json({ error: 'Ongeldig id' }, { status: 400 })
  }

  const { data } = await getBlogDb().from('arnobot_blog_posts').select('title, summary, slug').eq('id', body.id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  try {
    await sendBlogTestMail(data as Pick<BlogPost, 'title' | 'summary' | 'slug'>, TEST_TO)
    return NextResponse.json({ ok: true, to: TEST_TO })
  } catch (err) {
    console.error('[admin/blog/test-send]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Versturen mislukt' }, { status: 500 })
  }
}
