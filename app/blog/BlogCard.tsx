import Link from 'next/link'
import Image from 'next/image'
import type { BlogPostListItem } from '@/lib/blog'

export function formatBlogDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })
}

export default function BlogCard({ post }: { post: BlogPostListItem }) {
  return (
    <Link href={`/blog/${post.slug}`} className="bl-card">
      {post.cover_image_url && (
        <div className="bl-card-img">
          <Image src={post.cover_image_url} alt="" fill sizes="(max-width: 768px) 100vw, 330px" style={{ objectFit: 'cover' }} />
        </div>
      )}
      <div className="bl-card-body">
        {post.tags.length > 0 && <p className="bl-card-tags">{post.tags.map(t => `#${t}`).join(' ')}</p>}
        <h2 className="bl-card-title">{post.title}</h2>
        {post.summary && <p className="bl-card-sum">{post.summary}</p>}
        <p className="bl-card-date">{formatBlogDate(post.published_at)}</p>
      </div>
    </Link>
  )
}
