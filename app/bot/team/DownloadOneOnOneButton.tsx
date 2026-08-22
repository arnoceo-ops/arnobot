'use client'

import { useState } from 'react'

interface DownloadOneOnOneButtonProps {
  naam: string
  datum: string
  agenda: string
  notitie: string | null
  actie: string | null
  actieStatus: 'ja' | 'nee' | 'skip' | null
  mindsetScore: number | null
  systeemScore: number | null
  actieScore: number | null
  size?: 'large' | 'small'
}

export default function DownloadOneOnOneButton({ size = 'small', ...props }: DownloadOneOnOneButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { OneOnOnePdfDocument } = await import('./OneOnOnePdfDocument')
      const blob = await pdf(<OneOnOnePdfDocument {...props} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const datumSlug = new Date(props.datum).toISOString().slice(0, 10)
      const naamSlug = props.naam.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      a.href = url
      a.download = `1on1-${naamSlug}-${datumSlug}.pdf`
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
      className={size === 'large' ? 'pdf-btn' : 'btn-note'}
      onClick={handleDownload}
      disabled={loading}
    >
      {loading ? 'GENEREREN...' : 'DOWNLOAD PDF ↓'}
    </button>
  )
}
