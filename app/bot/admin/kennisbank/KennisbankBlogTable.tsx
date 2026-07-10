'use client'

import { useState } from 'react'

export type BlogRow = {
  title: string
  date: string
  dateISO: string
  url: string | null
  count: number
}

type SortCol = 'date' | 'title' | 'count'
type SortDir = 'asc' | 'desc'

export default function KennisbankBlogTable({ blogs }: { blogs: BlogRow[] }) {
  const [col, setCol] = useState<SortCol>('date')
  const [dir, setDir] = useState<SortDir>('desc')

  function toggle(c: SortCol) {
    if (col === c) {
      setDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setCol(c)
      setDir(c === 'count' ? 'desc' : c === 'date' ? 'desc' : 'asc')
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
    if (col !== c) return <span style={{ opacity: 0.3 }}> ↕</span>
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
          <th style={{ width: 130, paddingBottom: 12, textAlign: 'left' }}>
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
        {sorted.map((b, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
            <td style={{
              fontFamily: 'sans-serif',
              fontSize: 12,
              color: '#6b7280',
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
              fontSize: 12,
              color: '#6b7280',
              padding: '11px 0',
              textAlign: 'right',
              whiteSpace: 'nowrap',
              verticalAlign: 'middle',
            }}>
              {b.count}x
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
