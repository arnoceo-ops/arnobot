'use client'

import { useState } from 'react'

// Sorteerbare kolomkoppen voor de tabellen in Abacus. Eerste klik: getallen van groot naar klein, tekst van A naar Z. Nog een klik draait de volgorde om.

/** null betekent "geen waarde" (de "-" in de tabel): die rijen staan in beide richtingen onderaan. */
export type SorteerWaarde = string | number | null

type Sortering<K extends string> = { kolom: K; omgekeerd: boolean } | null

export function useSortering<K extends string>() {
  const [sortering, setSortering] = useState<Sortering<K>>(null)
  const klik = (kolom: K) => setSortering(s => ({ kolom, omgekeerd: s?.kolom === kolom ? !s.omgekeerd : false }))
  /** Zonder gekozen kolom blijft de volgorde van de server staan. */
  function sorteer<T>(rijen: T[], waarden: Record<K, (rij: T) => SorteerWaarde>): T[] {
    if (!sortering) return rijen
    const waarde = waarden[sortering.kolom]
    const richting = sortering.omgekeerd ? -1 : 1
    return [...rijen].sort((a, b) => {
      const x = waarde(a)
      const y = waarde(b)
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
      if (typeof x === 'number' && typeof y === 'number') return (y - x) * richting
      return String(x).localeCompare(String(y), 'nl', { sensitivity: 'base', numeric: true }) * richting
    })
  }
  return { sortering, klik, sorteer }
}

export function SorteerKop<K extends string>({ kolom, label, tekst = false, stijl, sortering, onKlik }: {
  kolom: K
  label: string
  /** Tekstkolom: links uitgelijnd en eerst van A naar Z. */
  tekst?: boolean
  stijl: React.CSSProperties
  sortering: Sortering<K>
  onKlik: (kolom: K) => void
}) {
  const actief = sortering?.kolom === kolom
  const omhoog = actief && (tekst ? !sortering.omgekeerd : sortering.omgekeerd)
  return (
    <th style={{ ...stijl, textAlign: tekst ? 'left' : 'right' }} aria-sort={actief ? (omhoog ? 'ascending' : 'descending') : undefined}>
      <button
        type="button"
        onClick={() => onKlik(kolom)}
        style={{ position: 'relative', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', textAlign: 'inherit', color: actief ? '#f59e0b' : 'inherit' }}
      >
        {label}
        {/* Het pijltje staat in de celmarge en neemt geen ruimte in: de kop lijnt zo gelijk uit met de waarden en verspringt niet bij het klikken. Bij getallen links van de kop, bij tekst rechts. */}
        {actief && <span aria-hidden="true" style={{ position: 'absolute', top: 0, ...(tekst ? { left: '100%' } : { right: '100%' }) }}>{omhoog ? '↑' : '↓'}</span>}
      </button>
    </th>
  )
}
