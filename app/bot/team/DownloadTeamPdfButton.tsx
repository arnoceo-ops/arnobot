'use client'

import { useState } from 'react'

interface DownloadTeamPdfButtonProps {
  teamNaam: string
  teamMsa: number | null
  mindsetScore: number | null
  systeemScore: number | null
  actieScore: number | null
  members: { naam: string; msa: number | null; sessies: number; analyses: number; laatsteActiviteit: string | null }[]
  spotlightText: string | null
  spotlightDatum: string | null
}

export default function DownloadTeamPdfButton(props: DownloadTeamPdfButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { TeamPdfDocument } = await import('./TeamPdfDocument')
      const datum = new Date().toISOString()
      const blob = await pdf(<TeamPdfDocument {...props} datum={datum} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const datumSlug = datum.slice(0, 10)
      const naamSlug = props.teamNaam.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      a.href = url
      a.download = `team-rapport-${naamSlug}-${datumSlug}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('PDF error:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button className="pdf-btn" onClick={handleDownload} disabled={loading}>
      {loading ? 'GENEREREN...' : 'DOWNLOAD TEAM-RAPPORT ↓'}
    </button>
  )
}
