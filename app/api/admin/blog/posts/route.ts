import { NextRequest, NextResponse, after } from 'next/server'
import { isAdminSession } from '@/lib/adminAuth'
import { getBlogDb, revalidateBlog, validatePostInput } from '@/lib/blog'
import { notifySubscribersOfPost, processBlogDeliveries } from '@/lib/blogMail'

export async function GET() {
  if (!(await isAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await getBlogDb()
    .from('arnobot_blog_posts')
    .select('id, slug, title, tags, status, publish_at, published_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  return NextResponse.json({ posts: data ?? [] })
}

export async function POST(req: NextRequest) {
  if (!(await isAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = validatePostInput(body)
  if (!parsed.ok) return NextResponse.json({ errors: parsed.errors }, { status: 400 })
  const v = parsed.value

  const { data, error } = await getBlogDb()
    .from('arnobot_blog_posts')
    .insert({
      ...v,
      published_at: v.status === 'published' ? new Date().toISOString() : null,
    })
    .select('id, slug, status')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ errors: ['Deze slug bestaat al.'] }, { status: 409 })
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }

  if (v.status === 'published') {
    revalidateBlog(v.slug)
    if (v.notify_subscribers) {
      // Na het antwoord: de wachtrij vullen en de eerste mails binnen het dagbudget versturen.
      after(async () => {
        try {
          await notifySubscribersOfPost({ id: data.id })
          await processBlogDeliveries()
        } catch (err) {
          console.error('[admin/blog] versturen naar abonnees mislukt:', err instanceof Error ? err.message : err)
        }
      })
    }
  }
  return NextResponse.json({ post: data }, { status: 201 })
}
