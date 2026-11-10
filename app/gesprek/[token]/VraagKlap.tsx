'use client'

import { useEffect, useRef, useState } from 'react'

const REGELS = 5

export default function VraagKlap({ tekst: ruweTekst }: { tekst: string }) {
  // Lege regels samenvoegen: ze tellen mee voor de 5 regels en laten dan een kale "…" over.
  const tekst = ruweTekst.replace(/\s*\n\s*/g, '\n').trim()
  const ref = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false)
  const [kanKlappen, setKanKlappen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const meet = () => {
      if (open) return
      setKanKlappen(el.scrollHeight > el.clientHeight + 1)
    }
    meet()
    window.addEventListener('resize', meet)
    return () => window.removeEventListener('resize', meet)
  }, [tekst, open])

  const afgekapt = !open
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p
        ref={ref}
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(18px,3vw,26px)',
          lineHeight: 1.5,
          color: '#f1f5f9',
          letterSpacing: 0.5,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          ...(afgekapt
            ? { display: '-webkit-box', WebkitLineClamp: REGELS, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }
            : {}),
        }}
      >
        {tekst}
      </p>
      {(kanKlappen || open) && (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          style={{
            marginTop: 10,
            padding: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 14,
            letterSpacing: 3,
            color: '#f59e0b',
          }}
        >
          {open ? 'MINDER' : 'LEES MEER'}
        </button>
      )}
    </div>
  )
}
