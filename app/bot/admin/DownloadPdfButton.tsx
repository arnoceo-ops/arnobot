'use client'

import { useState } from 'react'

export default function DownloadPdfButton({
  from,
  to,
  userFilter,
  sort,
  dateRange,
}: {
  from: string
  to: string
  userFilter: string
  sort: string
  dateRange: string
}) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to, user: userFilter, sort })
      const res = await fetch(`/api/admin/export?${params}`)
      if (!res.ok) throw new Error('Export mislukt')
      const { sessions } = await res.json()

      const { pdf } = await import('@react-pdf/renderer')
      const { ArnoBotPdfDocument } = await import('./ArnoBotPdfDocument')
      const blob = await pdf(<ArnoBotPdfDocument sessions={sessions} dateRange={dateRange} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `arnobot-gesprekken-${dateRange}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('PDF error:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      style={{ background: loading ? '#374151' : '#f59e0b', color: '#000', border: 'none', padding: '10px 20px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '12px', letterSpacing: '1px' }}
    >
      {loading ? 'GENEREREN...' : '↓ DOWNLOAD PDF'}
    </button>
  )
}
