'use client'

import { Fragment, useState } from 'react'

export type BlogRow = {
  title: string
  date: string
  dateISO: string
  url: string | null
  count: number
}

type Chunk = { id: string; content: string; context: string | null }

type SortCol = 'date' | 'title' | 'count'
type SortDir = 'asc' | 'desc'

export default function KennisbankBlogTable({ blogs }: { blogs: BlogRow[] }) {
  const [col, setCol] = useState<SortCol>('date')
  const [dir, setDir] = useState<SortDir>('desc')
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null)
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null)
  const [chunksByUrl, setChunksByUrl] = useState<Record<string, Chunk[]>>({})
  const [errorUrl, setErrorUrl] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [countOverride, setCountOverride] = useState<Record<string, number>>({})

  function toggle(c: SortCol) {
    if (col === c) {
      setDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setCol(c)
      setDir(c === 'count' ? 'desc' : c === 'date' ? 'desc' : 'asc')
    }
  }

  async function toggleExpand(url: string | null) {
    if (!url) return
    if (expandedUrl === url) {
      setExpandedUrl(null)
      return
    }
    setExpandedUrl(url)
    setErrorUrl(null)
    if (chunksByUrl[url]) return
    setLoadingUrl(url)
    try {
      const res = await fetch(`/api/admin/kennisbank-chunks?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ophalen mislukt')
      setChunksByUrl(prev => ({ ...prev, [url]: data.chunks }))
    } catch {
      setErrorUrl(url)
    } finally {
      setLoadingUrl(null)
    }
  }

  async function handleDelete(url: string, id: string) {
    if (!window.confirm('Deze chunk definitief verwijderen uit de kennisbank? Dit kan niet ongedaan gemaakt worden.')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/kennisbank-chunks?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verwijderen mislukt')
      setChunksByUrl(prev => ({ ...prev, [url]: prev[url].filter(c => c.id !== id) }))
      setCountOverride(prev => ({ ...prev, [url]: (prev[url] ?? blogs.find(b => b.url === url)?.count ?? 1) - 1 }))
    } catch {
      window.alert('Verwijderen is mislukt. Probeer het opnieuw.')
    } finally {
      setDeletingId(null)
    }
  }

  const sorted = [...blogs].sort((a, b) => {
    let cmp = 0
    if (col === 'date') cmp = a.dateISO.localeCompare(b.dateISO)
    else if (col === 'title') cmp = a.title.localeCompare(b.title, 'nl')
    else cmp = a.count - b.count
    return dir === 'asc' ? cmp : -cmp
  })

  function arrow(c: SortCol) {
    if (col !== c) return <span style={{ color: '#6b7280' }}> ↕</span>
    return <span style={{ color: '#f59e0b' }}>{dir === 'asc' ? ' ↑' : ' ↓'}</span>
  }

  const thBtn = (c: SortCol, align: 'left' | 'right' = 'left'): React.CSSProperties => ({
    fontFamily: 'sans-serif',
    fontSize: 12,
    letterSpacing: 4,
    color: col === c ? '#f59e0b' : '#6b7280',
    cursor: 'pointer',
    userSelect: 'none',
    background: 'none',
    border: 'none',
    padding: 0,
    textAlign: align,
    display: 'block',
    width: '100%',
  })

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ width: 250, paddingBottom: 12, textAlign: 'left' }}>
            <button onClick={() => toggle('date')} style={thBtn('date')}>DATUM{arrow('date')}</button>
          </th>
          <th style={{ paddingBottom: 12, textAlign: 'left' }}>
            <button onClick={() => toggle('title')} style={thBtn('title')}>TITEL{arrow('title')}</button>
          </th>
          <th style={{ width: 72, paddingBottom: 12, textAlign: 'right' }}>
            <button onClick={() => toggle('count')} style={thBtn('count', 'right')}>CHUNKS{arrow('count')}</button>
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((b, i) => {
          const isExpanded = !!b.url && expandedUrl === b.url
          return (
            <Fragment key={i}>
              <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid #1f2937' }}>
                <td style={{
                  fontFamily: 'sans-serif',
                  fontSize: 14,
                  color: '#9ca3af',
                  padding: '11px 16px 11px 0',
                  whiteSpace: 'nowrap',
                  verticalAlign: 'middle',
                }}>
                  {b.date}
                </td>
                <td style={{ padding: '11px 16px 11px 0', verticalAlign: 'middle', overflow: 'hidden', maxWidth: 0 }}>
                  {b.url ? (
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="kb-link"
                      style={{
                        fontFamily: 'sans-serif',
                        fontSize: 14,
                        color: '#9ca3af',
                        textDecoration: 'none',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {b.title}
                    </a>
                  ) : (
                    <span style={{
                      fontFamily: 'sans-serif',
                      fontSize: 14,
                      color: '#9ca3af',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {b.title}
                    </span>
                  )}
                </td>
                <td style={{
                  fontFamily: 'sans-serif',
                  fontSize: 14,
                  color: '#9ca3af',
                  padding: '11px 0',
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  verticalAlign: 'middle',
                }}>
                  {b.url ? (
                    <button
                      onClick={() => toggleExpand(b.url)}
                      style={{
                        fontFamily: 'sans-serif',
                        fontSize: 14,
                        color: isExpanded ? '#f59e0b' : '#9ca3af',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {countOverride[b.url] ?? b.count}x{isExpanded ? ' ↑' : ' ↓'}
                    </button>
                  ) : (
                    <span>{b.count}x</span>
                  )}
                </td>
              </tr>
              {isExpanded && (
                <tr style={{ borderBottom: '1px solid #1f2937' }}>
                  <td colSpan={3} style={{ padding: '0 0 20px 0' }}>
                    <div style={{ background: '#161f2e', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {loadingUrl === b.url && (
                        <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280' }}>Chunks laden...</p>
                      )}
                      {errorUrl === b.url && (
                        <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#cc4444' }}>Ophalen mislukt. Probeer opnieuw.</p>
                      )}
                      {chunksByUrl[b.url!]?.map((chunk, idx) => (
                        <div key={chunk.id} style={{ borderLeft: '2px solid #374151', paddingLeft: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, color: '#6b7280' }}>CHUNK {idx + 1}</p>
                            <button
                              onClick={() => handleDelete(b.url!, chunk.id)}
                              disabled={deletingId === chunk.id}
                              style={{
                                fontFamily: 'sans-serif',
                                fontSize: 12,
                                letterSpacing: 1,
                                color: '#cc4444',
                                background: 'none',
                                border: 'none',
                                cursor: deletingId === chunk.id ? 'default' : 'pointer',
                                opacity: deletingId === chunk.id ? 0.5 : 1,
                                padding: 0,
                              }}
                            >
                              {deletingId === chunk.id ? 'BEZIG...' : 'VERWIJDER'}
                            </button>
                          </div>
                          {chunk.context && (
                            <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', marginBottom: 6, fontStyle: 'italic' }}>{chunk.context}</p>
                          )}
                          <p style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#9ca3af', whiteSpace: 'pre-wrap' }}>{chunk.content}</p>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
