import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath, revalidateTag } from 'next/cache'
import {
  RESERVED_SLUGS,
  findForbiddenDashes,
  isValidSlug,
  normalizeTags,
  slugify,
} from './blogText'

// Server-kant van de blog: databasetoegang en validatie. Alleen vanuit server-code importeren.
// Publieke pagina's lezen via de service-role-client (de tabellen hebben RLS aan zonder
// policies) en tonen uitsluitend gepubliceerde posts.

export const BLOG_BASE_URL = 'https://www.arno.bot'
export const BLOG_IMAGE_BUCKET = 'blog-images'
export const BLOG_CACHE_TAG = 'blog'
const BLOG_CACHE_SECONDS = 3600

export type BlogStatus = 'draft' | 'scheduled' | 'published'

export interface BlogPost {
  id: string
  slug: string
  title: string
  summary: string
  body_md: string
  cover_image_url: string | null
  tags: string[]
  status: BlogStatus
  publish_at: string | null
  published_at: string | null
  notify_subscribers: boolean
  notified_at: string | null
  created_at: string
  updated_at: string
}

export type BlogPostListItem = Pick<
  BlogPost,
  'id' | 'slug' | 'title' | 'summary' | 'cover_image_url' | 'tags' | 'published_at'
>

const LIST_FIELDS = 'id, slug, title, summary, cover_image_url, tags, published_at'

// Untyped, net als de andere routes: de gegenereerde Database-types kennen deze tabellen niet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: SupabaseClient<any, 'public', any> | null = null
export function getBlogDb() {
  if (!_db) {
    _db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
  }
  return _db
}

// Leesclient voor de publieke pagina's. De root layout leest headers() (CSP-nonce), dus alle
// pagina's worden per verzoek gerenderd; om bij veel lezers niet elke keer de database te
// raken cachen we de Supabase-GET's via Next's fetch-cache. revalidateBlog() ververst die
// cache direct na elke wijziging in de admin. Daarom staat er bewust geen tijdstip in de
// query-URL (dat zou elke aanroep een andere cachesleutel geven).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _readDb: SupabaseClient<any, 'public', any> | null = null
export function getBlogReadDb() {
  if (!_readDb) {
    _readDb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, next: { revalidate: BLOG_CACHE_SECONDS, tags: [BLOG_CACHE_TAG] } } as RequestInit),
      },
    })
  }
  return _readDb
}

// ─── Publiek lezen ───────────────────────────────────────────────────

export async function getPublishedPosts(): Promise<BlogPostListItem[]> {
  const { data, error } = await getBlogReadDb()
    .from('arnobot_blog_posts')
    .select(LIST_FIELDS)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
  if (error) throw new Error(`Blogposts ophalen mislukt: ${error.message}`)
  return (data ?? []) as unknown as BlogPostListItem[]
}

export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
  const { data, error } = await getBlogReadDb()
    .from('arnobot_blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw new Error(`Blogpost ophalen mislukt: ${error.message}`)
  return (data as unknown as BlogPost) ?? null
}

export function countTags(posts: Pick<BlogPostListItem, 'tags'>[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const p of posts) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

// Gerelateerde posts: meeste gedeelde tags eerst, bij gelijkstand de nieuwste.
export function relatedPosts(current: BlogPost, all: BlogPostListItem[], limit = 3): BlogPostListItem[] {
  return all
    .filter(p => p.id !== current.id)
    .map(p => ({ p, shared: p.tags.filter(t => current.tags.includes(t)).length }))
    .filter(x => x.shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map(x => x.p)
}

// ─── Admin: invoer valideren ─────────────────────────────────────────

export interface PostInput {
  title: string
  slug: string
  summary: string
  body_md: string
  cover_image_url: string | null
  tags: string[]
  status: BlogStatus
  publish_at: string | null
  notify_subscribers: boolean
}

const MAX_TITLE = 140
const MAX_SUMMARY = 300
const MAX_BODY = 100_000

function isOwnImageUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !!base && url.startsWith(`${base}/storage/v1/object/public/${BLOG_IMAGE_BUCKET}/`)
}

export function validatePostInput(raw: unknown): { ok: true; value: PostInput } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const title = typeof b.title === 'string' ? b.title.trim() : ''
  const summary = typeof b.summary === 'string' ? b.summary.trim() : ''
  const body_md = typeof b.body_md === 'string' ? b.body_md : ''
  const slug = typeof b.slug === 'string' && b.slug.trim() ? b.slug.trim() : slugify(title)
  const status = b.status as BlogStatus
  const tags = normalizeTags(b.tags)
  const cover = typeof b.cover_image_url === 'string' && b.cover_image_url.trim() ? b.cover_image_url.trim() : null

  if (!title) errors.push('Titel is verplicht.')
  if (title.length > MAX_TITLE) errors.push(`Titel is te lang (max ${MAX_TITLE} tekens).`)
  if (summary.length > MAX_SUMMARY) errors.push(`Samenvatting is te lang (max ${MAX_SUMMARY} tekens).`)
  if (body_md.length > MAX_BODY) errors.push('Tekst is te lang.')
  if (!isValidSlug(slug)) {
    errors.push(
      RESERVED_SLUGS.includes(slug)
        ? `De slug "${slug}" is gereserveerd.`
        : 'Slug mag alleen kleine letters, cijfers en enkele koppeltekens bevatten.'
    )
  }
  if (!['draft', 'scheduled', 'published'].includes(status)) errors.push('Ongeldige status.')
  if (cover && !isOwnImageUrl(cover)) errors.push('Omslagafbeelding moet een geuploade afbeelding zijn.')

  let publish_at: string | null = null
  if (status === 'scheduled') {
    const d = typeof b.publish_at === 'string' ? new Date(b.publish_at) : null
    if (!d || Number.isNaN(d.getTime())) errors.push('Kies een geldig tijdstip om in te plannen.')
    else if (d.getTime() <= Date.now()) errors.push('Het ingeplande tijdstip moet in de toekomst liggen.')
    else publish_at = d.toISOString()
  }

  // Huisregel: geen streepjes als leesteken in teksten van arno.bot.
  for (const [label, text] of [['titel', title], ['samenvatting', summary], ['tekst', body_md]] as const) {
    for (const hit of findForbiddenDashes(text)) errors.push(`Streepje in ${label}: "${hit}"`)
  }

  if (errors.length) return { ok: false, errors }
  const notify_subscribers = b.notify_subscribers === true
  return { ok: true, value: { title, slug, summary, body_md, cover_image_url: cover, tags, status, publish_at, notify_subscribers } }
}

// ─── Cache verversen ─────────────────────────────────────────────────

// Na elke wijziging die zichtbaar kan zijn: de gecachete leesdata direct ongeldig maken
// (tag) en de paden als verouderd markeren.
export function revalidateBlog(slug?: string) {
  revalidateTag(BLOG_CACHE_TAG, { expire: 0 })
  revalidatePath('/blog')
  revalidatePath('/blog/[slug]', 'page')
  revalidatePath('/blog/tag/[tag]', 'page')
  revalidatePath('/blog/feed.xml')
  revalidatePath('/sitemap.xml')
  if (slug) revalidatePath(`/blog/${slug}`)
}
