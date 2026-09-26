'use client'

import { useState } from 'react'

// Kopieerknop voor de Gesprekken-pagina (/bot/admin): kopieert platte tekst naar het
// klembord, met een kort vinkje als feedback, net als het copy-icoon bij llm-chats.
// Hergebruikt voor zowel een hele sessie als één los bericht, alleen `label` verschilt.
export default function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Klembord-API kan falen (oude browser, geen HTTPS-context buiten dit domein e.d.);
      // stil negeren is hier acceptabel, er is geen tweede kans nodig voor een adminknopje.
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Kopieer ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        border: 'none',
        padding: '2px 4px',
        cursor: 'pointer',
        color: copied ? '#f59e0b' : '#6b7280',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '12px',
      }}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
      {copied ? 'GEKOPIEERD' : `KOPIEER ${label}`}
    </button>
  )
}
