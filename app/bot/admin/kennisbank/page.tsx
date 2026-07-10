import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import AdminNav from '../AdminNav'
import RssIngestButton from './RssIngestButton'

export const dynamic = 'force-dynamic'

type ChunkRow = {
  source: string
  url: string | null
}

type SourceSummary = {
  source: string
  url: string | null
  count: number
  type: 'video' | 'blog'
}

export default async function KennisbankPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data, error }, { data: metaData }] = await Promise.all([
    supabase.from('blog_chunks').select('source, url'),
    supabase.from('arnobot_meta').select('key, value').in('key', ['last_embed_run', 'last_embed_chunks', 'last_embed_sources']),
  ])

  const meta: Record<string, string> = {}
  for (const row of metaData ?? []) meta[row.key] = row.value

  const sourceMap: Record<string, { url: string | null; count: number }> = {}
  for (const row of (data as ChunkRow[] | null) ?? []) {
    if (!sourceMap[row.source]) {
      sourceMap[row.source] = { url: row.url, count: 0 }
    }
    sourceMap[row.source].count++
  }

  const sources: SourceSummary[] = Object.entries(sourceMap)
    .map(([source, info]) => ({
      source,
      url: info.url,
      count: info.count,
      type: (source.startsWith('Video:') ? 'video' : 'blog') as 'video' | 'blog',
    }))
    .sort((a, b) => a.source.localeCompare(b.source))

  const totalChunks = data?.length ?? 0
  const blogSources = sources.filter(s => s.type === 'blog')
  const videoSources = sources.filter(s => s.type === 'video')

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: "'Space Mono', monospace" }}>
      <AdminNav active="/bot/admin/kennisbank" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .kb-link:hover { color: #f1f5f9 !important; }
      `}</style>
      <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', marginBottom: 48, lineHeight: 1 }}>KENNISBANK</h1>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 40, marginBottom: 56, alignItems: 'flex-end' }}>
          <div>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: '#f1f5f9', lineHeight: 1 }}>{totalChunks}</span>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 3, color: '#6b7280', marginTop: 6 }}>CHUNKS</p>
          </div>
          <div>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: '#f1f5f9', lineHeight: 1 }}>{blogSources.length}</span>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 3, color: '#6b7280', marginTop: 6 }}>BLOGS</p>
          </div>
          <div>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: '#f1f5f9', lineHeight: 1 }}>{videoSources.length}</span>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 3, color: '#6b7280', marginTop: 6 }}>VIDEO&apos;S</p>
          </div>
        </div>

        {/* Laatste embed run + RSS trigger */}
        <div style={{ background: '#1f2937', padding: '16px 20px', marginBottom: 48, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 3, color: '#6b7280', marginBottom: 4 }}>LAATSTE EMBED RUN</p>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: meta['last_embed_run'] ? '#f1f5f9' : '#374151' }}>
                {meta['last_embed_run']
                  ? new Date(meta['last_embed_run']).toLocaleString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Nog nooit gedraaid'}
              </p>
            </div>
            {meta['last_embed_sources'] && (
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#4b5563' }}>{meta['last_embed_sources']}</p>
            )}
          </div>
          <div style={{ borderTop: '1px solid #374151', paddingTop: 16 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 3, color: '#6b7280', marginBottom: 12 }}>RSS INGEST — loopt automatisch elke zaterdag om middernacht UTC</p>
            <RssIngestButton />
          </div>
        </div>

        {error && (
          <p style={{ color: '#cc4444', fontSize: 13, marginBottom: 24 }}>Fout bij laden: {error.message}</p>
        )}

        {sources.length === 0 && !error && (
          <p style={{ color: '#374151', fontSize: 13, letterSpacing: 3 }}>KENNISBANK IS LEEG</p>
        )}

        {/* Blogs */}
        {blogSources.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 4, color: '#f59e0b', marginBottom: 16 }}>BLOGS ({blogSources.length})</p>
            {blogSources.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid #1f2937' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="kb-link"
                      style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#9ca3af', lineHeight: 1.6, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.15s' }}
                    >
                      {s.source}
                    </a>
                  ) : (
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#9ca3af', lineHeight: 1.6, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.source}
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#374151', flexShrink: 0 }}>{s.count}x</span>
              </div>
            ))}
          </div>
        )}

        {/* Video's */}
        {videoSources.length > 0 && (
          <div>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 4, color: '#f59e0b', marginBottom: 16 }}>VIDEO&apos;S ({videoSources.length})</p>
            {videoSources.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid #1f2937' }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#9ca3af', lineHeight: 1.6, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.source.replace('Video: ', '')}
                </span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#374151', flexShrink: 0 }}>{s.count}x</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
