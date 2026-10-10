'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { renderMarkdown } from '@/lib/blogMarkdown'
import { findForbiddenDashes, normalizeTag, slugify, readingMinutes, MAX_TAGS } from '@/lib/blogText'
import type { BlogPost, BlogStatus } from '@/lib/blog'

interface Props {
  initial: BlogPost | null
  existingTags: string[]
  subscriberCount: number
}

interface Backup {
  title: string
  slug: string
  summary: string
  body: string
  tags: string[]
  cover: string
  ts: number
}

const label = { display: 'block', fontSize: 12, letterSpacing: 3, color: '#f59e0b', fontWeight: 700, marginBottom: 8 } as const
const muted = { fontSize: 14, color: '#6b7280' } as const

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function PostEditor({ initial, existingTags, subscriberCount }: Props) {
  const router = useRouter()
  const postId = initial?.id ?? null
  const backupKey = `blogdraft:${postId ?? 'nieuw'}`

  const [title, setTitle] = useState(initial?.title ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!!initial)
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [body, setBody] = useState(initial?.body_md ?? '')
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [cover, setCover] = useState(initial?.cover_image_url ?? '')
  const [publishAt, setPublishAt] = useState(toLocalInput(initial?.publish_at ?? null))
  const [notify, setNotify] = useState(initial?.notify_subscribers ?? false)
  const [notifiedAt, setNotifiedAt] = useState<string | null>(initial?.notified_at ?? null)
  const [testing, setTesting] = useState(false)

  const [savedStatus, setSavedStatus] = useState<BlogStatus | null>(initial?.status ?? null)
  const [savedSlug, setSavedSlug] = useState(initial?.slug ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [backup, setBackup] = useState<Backup | null>(null)

  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const snapshot = useRef(JSON.stringify([initial?.title ?? '', initial?.slug ?? '', initial?.summary ?? '', initial?.body_md ?? '', initial?.tags ?? [], initial?.cover_image_url ?? '']))

  const current = JSON.stringify([title, slug, summary, body, tags, cover])
  const dirty = current !== snapshot.current

  // Noodback-up in de browser: een verlopen sessie of per ongeluk gesloten tabblad kost
  // geen tekst. Bij terugkomst biedt de editor het herstel aan.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(backupKey)
      if (raw) {
        const b = JSON.parse(raw) as Backup
        if (JSON.stringify([b.title, b.slug, b.summary, b.body, b.tags, b.cover]) !== snapshot.current) setBackup(b)
      }
    } catch { /* geen localStorage beschikbaar: geen back-up, editor werkt gewoon */ }
  }, [backupKey])

  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => {
      try {
        const b: Backup = { title, slug, summary, body, tags, cover, ts: Date.now() }
        localStorage.setItem(backupKey, JSON.stringify(b))
      } catch { /* zie boven */ }
    }, 800)
    return () => clearTimeout(t)
  }, [dirty, title, slug, summary, body, tags, cover, backupKey])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function restoreBackup() {
    if (!backup) return
    setTitle(backup.title); setSlug(backup.slug); setSummary(backup.summary)
    setBody(backup.body); setTags(backup.tags); setCover(backup.cover)
    setSlugTouched(true)
    setBackup(null)
  }

  function discardBackup() {
    try { localStorage.removeItem(backupKey) } catch { /* zie boven */ }
    setBackup(null)
  }

  function onTitleChange(v: string) {
    setTitle(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  function addTag(raw: string) {
    const t = normalizeTag(raw)
    if (!t || tags.includes(t) || tags.length >= MAX_TAGS) return
    setTags([...tags, t])
    setTagInput('')
  }

  async function uploadImage(file: File): Promise<string | null> {
    setUploading(true)
    setErrors([])
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/blog/upload', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErrors([data.error ?? 'Uploaden mislukt']); return null }
      return data.url as string
    } catch {
      setErrors(['Uploaden mislukt'])
      return null
    } finally {
      setUploading(false)
    }
  }

  async function insertImages(files: File[]) {
    for (const f of files) {
      const url = await uploadImage(f)
      if (!url) return
      const ta = bodyRef.current
      const at = ta ? ta.selectionStart : body.length
      const md = `\n\n![](${url})\n\n`
      setBody(prev => prev.slice(0, at) + md + prev.slice(at))
    }
  }

  async function onCoverFile(file: File | undefined) {
    if (!file) return
    const url = await uploadImage(file)
    if (url) setCover(url)
  }

  async function save(status: BlogStatus) {
    setErrors([]); setNotice('')
    if (status === 'scheduled' && !publishAt) { setErrors(['Kies eerst een tijdstip om in te plannen.']); return }

    setSaving(true)
    try {
      const payload = {
        title, slug, summary, body_md: body, cover_image_url: cover || null, tags, status,
        publish_at: status === 'scheduled' ? new Date(publishAt).toISOString() : null,
        notify_subscribers: notify,
      }
      const res = await fetch(postId ? `/api/admin/blog/posts/${postId}` : '/api/admin/blog/posts', {
        method: postId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErrors(data.errors ?? [data.error ?? 'Opslaan mislukt']); return }

      snapshot.current = current
      try { localStorage.removeItem(backupKey) } catch { /* zie boven */ }
      setSavedStatus(status)
      setSavedSlug(slug)
      if (status === 'published' && notify && !notifiedAt) setNotifiedAt(new Date().toISOString())
      setNotice(status === 'published' ? (notify && !notifiedAt ? 'Opgeslagen, live en ingepland voor abonnees.' : 'Opgeslagen en live.') : status === 'scheduled' ? 'Ingepland.' : 'Opgeslagen als concept.')

      if (!postId) router.replace(`/bot/admin/blog/${data.post.id}`)
      else router.refresh()
    } catch {
      setErrors(['Opslaan mislukt, controleer je verbinding'])
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    if (!postId || testing) return
    setTesting(true); setErrors([]); setNotice('')
    try {
      const res = await fetch('/api/admin/blog/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErrors([data.error ?? 'Testmail versturen mislukt']); return }
      setNotice(`Testmail gestuurd naar ${data.to}.`)
    } catch {
      setErrors(['Testmail versturen mislukt'])
    } finally {
      setTesting(false)
    }
  }

  async function remove() {
    if (!postId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/blog/posts/${postId}`, { method: 'DELETE' })
      if (!res.ok) { setErrors(['Verwijderen mislukt']); return }
      try { localStorage.removeItem(backupKey) } catch { /* zie boven */ }
      snapshot.current = current
      router.replace('/bot/admin/blog')
    } catch {
      setErrors(['Verwijderen mislukt'])
    } finally {
      setSaving(false)
    }
  }

  const dashHits = useMemo(
    () => [
      ...findForbiddenDashes(title).map(h => `titel: "${h}"`),
      ...findForbiddenDashes(summary).map(h => `samenvatting: "${h}"`),
      ...findForbiddenDashes(body).map(h => `tekst: "${h}"`),
    ],
    [title, summary, body]
  )
  const html = useMemo(() => renderMarkdown(body), [body])
  const suggestions = existingTags.filter(t => !tags.includes(t) && (!tagInput || t.includes(normalizeTag(tagInput)))).slice(0, 12)
  const isLive = savedStatus === 'published'

  const input = { width: '100%', background: '#1f2937', border: '1px solid #374151', borderRadius: 4, padding: '10px 12px', color: '#f1f5f9', fontFamily: 'sans-serif', fontSize: 14 } as const
  const btnPrimary = { background: '#f59e0b', color: '#111827', border: 'none', fontSize: 12, fontWeight: 700, letterSpacing: 3, padding: '10px 20px', borderRadius: 4, cursor: 'pointer' } as const
  const btnSecondary = { background: 'none', color: '#9ca3af', border: '1px solid #374151', fontSize: 12, fontWeight: 700, letterSpacing: 3, padding: '10px 20px', borderRadius: 4, cursor: 'pointer' } as const
  const btnDanger = { ...btnSecondary, color: '#cc2200', border: '1px solid #cc2200' } as const

  return (
    <div className="admin-content" style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 40px 80px' }}>
      <style>{`
        .bl-in:focus { outline: none; border-color: #f59e0b !important; }
        .bl-in::placeholder { color: #6b7280; }
        .bl-preview { font-size: 14px; line-height: 1.8; color: #9ca3af; }
        .bl-preview h1, .bl-preview h2, .bl-preview h3, .bl-preview h4 { font-size: 14px; font-weight: 700; color: #f1f5f9; margin: 24px 0 8px; }
        .bl-preview p { margin: 0 0 14px; }
        .bl-preview a { color: #f59e0b; }
        .bl-preview img { max-width: 100%; height: auto; border-radius: 4px; }
        .bl-preview ul, .bl-preview ol { margin: 0 0 14px 20px; }
        .bl-preview blockquote { border-left: 2px solid #374151; padding-left: 14px; color: #9ca3af; margin: 0 0 14px; }
        .bl-preview code { background: #1f2937; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
        .bl-preview pre { background: #1f2937; padding: 12px; border-radius: 4px; overflow-x: auto; margin: 0 0 14px; }
        .bl-preview table { border-collapse: collapse; margin: 0 0 14px; }
        .bl-preview th, .bl-preview td { border: 1px solid #374151; padding: 6px 10px; font-size: 14px; }
      `}</style>

      <Link href="/bot/admin/blog" style={{ fontSize: 12, letterSpacing: 3, color: '#6b7280', textDecoration: 'none' }}>← POSTS</Link>
      <p style={{ color: '#f59e0b', fontSize: 12, letterSpacing: 4, margin: '24px 0 8px' }}>ARNOBOT ADMIN</p>
      <h1 style={{ fontSize: 48, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-1px' }}>{postId ? 'Post bewerken' : 'Nieuwe post'}</h1>
      <p style={{ ...muted, marginBottom: 32 }}>
        {savedStatus === 'published' ? 'Live op arno.bot/blog.' : savedStatus === 'scheduled' ? 'Ingepland.' : 'Concept, nog niet zichtbaar voor bezoekers.'}
        {isLive && <> <a href={`/blog/${savedSlug}`} target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>Bekijk op de site</a></>}
      </p>

      {backup && (
        <div style={{ border: '1px solid #f59e0b', borderRadius: 4, padding: '14px 16px', marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: '#f1f5f9', flex: 1, minWidth: 240 }}>
            Er is een niet opgeslagen versie van {new Date(backup.ts).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })} gevonden.
          </span>
          <button type="button" onClick={restoreBackup} style={btnPrimary}>HERSTEL</button>
          <button type="button" onClick={discardBackup} style={btnSecondary}>NEGEER</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 40, alignItems: 'start' }}>
        <div>
          <div style={{ marginBottom: 24 }}>
            <label style={label} htmlFor="bl-title">TITEL</label>
            <input id="bl-title" className="bl-in" style={input} value={title} onChange={e => onTitleChange(e.target.value)} maxLength={140} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={label} htmlFor="bl-slug">SLUG</label>
            <input id="bl-slug" className="bl-in" style={input} value={slug} onChange={e => { setSlugTouched(true); setSlug(slugify(e.target.value)) }} />
            <p style={{ ...muted, marginTop: 6 }}>arno.bot/blog/{slug || '...'}{isLive && slug !== savedSlug ? ' (de oude link stopt dan met werken)' : ''}</p>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={label} htmlFor="bl-summary">SAMENVATTING</label>
            <textarea id="bl-summary" className="bl-in" style={{ ...input, minHeight: 80, resize: 'vertical' }} value={summary} onChange={e => setSummary(e.target.value)} maxLength={300} />
            <p style={{ ...muted, marginTop: 6 }}>Verschijnt in Google, bij het delen en in de mail. {summary.length}/300</p>
          </div>

          <div style={{ marginBottom: 24 }}>
            <span style={label}>HASHTAGS</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {tags.map(t => (
                <button key={t} type="button" onClick={() => setTags(tags.filter(x => x !== t))} style={{ ...btnSecondary, padding: '6px 12px', letterSpacing: 1, color: '#f1f5f9' }}>#{t} ×</button>
              ))}
            </div>
            {tags.length < MAX_TAGS && (
              <input
                className="bl-in" style={input} value={tagInput} placeholder="Typ een hashtag en druk op enter"
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }}
              />
            )}
            {suggestions.length > 0 && tags.length < MAX_TAGS && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {suggestions.map(t => (
                  <button key={t} type="button" onClick={() => addTag(t)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 14, cursor: 'pointer', padding: 0 }}>#{t}</button>
                ))}
              </div>
            )}
            <p style={{ ...muted, marginTop: 6 }}>Maximaal {MAX_TAGS}. Kleine letters, geen spaties.</p>
          </div>

          <div style={{ marginBottom: 24 }}>
            <span style={label}>OMSLAGAFBEELDING</span>
            {cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" style={{ maxWidth: 240, height: 'auto', borderRadius: 4, display: 'block', marginBottom: 8 }} />
            )}
            <label style={{ ...btnSecondary, display: 'inline-block' }}>
              {uploading ? 'BEZIG...' : cover ? 'VERVANG' : 'KIES AFBEELDING'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { onCoverFile(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            {cover && <button type="button" onClick={() => setCover('')} style={{ ...btnSecondary, marginLeft: 8 }}>VERWIJDER</button>}
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={label} htmlFor="bl-body">TEKST (MARKDOWN)</label>
            <textarea
              id="bl-body" ref={bodyRef} className="bl-in"
              style={{ ...input, minHeight: 420, resize: 'vertical', fontFamily: 'monospace' }}
              value={body} onChange={e => setBody(e.target.value)}
              onPaste={e => {
                const files = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'))
                if (files.length) { e.preventDefault(); insertImages(files) }
              }}
              onDrop={e => {
                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
                if (files.length) { e.preventDefault(); insertImages(files) }
              }}
            />
            <p style={{ ...muted, marginTop: 6 }}>
              Plak of sleep een afbeelding in het tekstveld om hem in te voegen. {readingMinutes(body)} min leestijd.
            </p>
          </div>
        </div>

        <div>
          <span style={label}>VOORBEELD</span>
          <div style={{ border: '1px solid #374151', borderRadius: 4, padding: 24, background: '#111827' }}>
            {title && <p style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>{title}</p>}
            {tags.length > 0 && <p style={{ ...muted, marginBottom: 16 }}>{tags.map(t => `#${t}`).join(' ')}</p>}
            {cover && (
              // Zelfde 16:9-uitsnede als op de site, zodat je ziet wat er wordt bijgesneden.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 4, marginBottom: 16 }} />
            )}
            {/* Veilig: renderMarkdown escapet ruwe HTML en filtert URL-schema's. */}
            <div className="bl-preview" dangerouslySetInnerHTML={{ __html: html }} />
            {!body && <p style={muted}>Het voorbeeld verschijnt zodra je tekst schrijft.</p>}
          </div>
          <p style={{ ...muted, marginTop: 8 }}>Dit is een snel voorbeeld. De echte opmaak zie je op de site.</p>
        </div>
      </div>

      {(dashHits.length > 0 || errors.length > 0) && (
        <div style={{ margin: '32px 0 0', border: '1px solid #cc2200', borderRadius: 4, padding: '14px 16px' }}>
          {dashHits.length > 0 && (
            <p style={{ fontSize: 14, color: '#f59e0b', marginBottom: errors.length ? 8 : 0 }}>
              Streepjes gevonden. Herschrijf zonder streepje voordat je publiceert: {dashHits.join('; ')}
            </p>
          )}
          {errors.map((e, i) => <p key={i} style={{ fontSize: 14, color: '#f1f5f9' }}>{e}</p>)}
        </div>
      )}

      <div style={{ marginTop: 32, borderTop: '1px solid #1e293b', paddingTop: 24 }}>
        <span style={label}>ABONNEES</span>
        {notifiedAt ? (
          <p style={muted}>Verstuurd naar abonnees op {new Date(notifiedAt).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })}.</p>
        ) : (
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: '#f1f5f9', cursor: 'pointer' }}>
            <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
            Verstuur naar abonnees zodra de post live is ({subscriberCount} bevestigd)
          </label>
        )}
        <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" disabled={!postId || testing || dirty} onClick={sendTest} style={{ ...btnSecondary, opacity: !postId || testing || dirty ? 0.5 : 1 }}>
            {testing ? 'BEZIG...' : 'STUUR TESTMAIL NAAR MEZELF'}
          </button>
          {(!postId || dirty) && <span style={muted}>Sla de post eerst op.</span>}
        </div>
      </div>

      <div style={{ marginTop: 24, borderTop: '1px solid #1e293b', paddingTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" disabled={saving} onClick={() => save('published')} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'BEZIG...' : isLive ? 'OPSLAAN' : 'PUBLICEER NU'}
        </button>
        <button type="button" disabled={saving} onClick={() => save('draft')} style={{ ...btnSecondary, opacity: saving ? 0.6 : 1 }}>
          {isLive ? 'TERUG NAAR CONCEPT' : 'OPSLAAN ALS CONCEPT'}
        </button>
        <span style={{ width: 24 }} />
        <input type="datetime-local" className="bl-in" style={{ ...input, width: 'auto' }} value={publishAt} onChange={e => setPublishAt(e.target.value)} />
        <button type="button" disabled={saving} onClick={() => save('scheduled')} style={{ ...btnSecondary, opacity: saving ? 0.6 : 1 }}>INPLANNEN</button>
        {notice && <span style={{ fontSize: 14, color: '#10b981' }}>{notice}</span>}
        <span style={{ flex: 1 }} />
        {postId && (confirmDelete
          ? <button type="button" disabled={saving} onClick={remove} style={btnDanger}>WEET JE HET ZEKER?</button>
          : <button type="button" onClick={() => setConfirmDelete(true)} style={btnDanger}>VERWIJDER</button>)}
      </div>
    </div>
  )
}
