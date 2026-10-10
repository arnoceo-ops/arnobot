import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import AdminNav from '../../AdminNav'
import { getBlogDb, type BlogPost } from '@/lib/blog'
import { countTags } from '@/lib/blog'
import PostEditor from './PostEditor'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function AdminBlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const { id } = await params
  const db = getBlogDb()

  let post: BlogPost | null = null
  if (id !== 'nieuw') {
    if (!UUID.test(id)) notFound()
    const { data } = await db.from('arnobot_blog_posts').select('*').eq('id', id).maybeSingle()
    if (!data) notFound()
    post = data as unknown as BlogPost
  }

  // Bestaande tags als suggestie, zodat dezelfde tag niet in drie spellingen ontstaat.
  const { data: tagRows } = await db.from('arnobot_blog_posts').select('tags')
  const existingTags = countTags((tagRows ?? []) as { tags: string[] }[]).map(t => t.tag)

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <AdminNav active="/bot/admin/blog" />
      <PostEditor initial={post} existingTags={existingTags} />
    </main>
  )
}
