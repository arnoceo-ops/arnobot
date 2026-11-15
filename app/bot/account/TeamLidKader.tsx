'use client'

import { useIsNativeApp } from '@/hooks/useIsNativeApp'

// Kader bovenaan de accountpagina van een teamlid wiens team geblokkeerd is (docs/TEAM_LEVENSCYCLUS.md): wat er
// aan de hand is en wat hij kan doen. Een lid mag dan zelf een abonnement nemen. In de Android-app verborgen,
// net als andere koopverwijzingen (Google Play-beleid). Opmaak gelijk aan het kader TEAMPROEF (TeamActiverenSectie).

const mono = "'Space Mono', monospace"
const bebas = "'Bebas Neue', sans-serif"

export default function TeamLidKader({ teamNaam }: { teamNaam: string | null }) {
  const isNativeApp = useIsNativeApp()
  if (isNativeApp) return null
  return (
    <div style={{ background: '#1f2937', borderLeft: '4px solid #cc2200', padding: '24px 28px', marginBottom: 48 }}>
      <p style={{ fontFamily: mono, fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 12 }}>TEAM</p>
      <h2 style={{ fontFamily: bebas, fontSize: 44, letterSpacing: 3, lineHeight: 1, color: '#f1f5f9', margin: '0 0 14px 0' }}>TEAM NIET ACTIEF</h2>
      <p style={{ fontWeight: 400, color: '#9ca3af', fontSize: 15, lineHeight: '1.9', margin: '0 0 24px 0' }}>
        Het teamabonnement van {teamNaam ?? 'je team'} is niet actief, daarom heb je geen toegang. Vraag je teammanager het team te activeren, of neem zelf een abonnement.
      </p>
      <a
        href="/bot/doorgaan"
        style={{ padding: '12px 36px', border: 'none', background: '#f59e0b', color: '#111827', fontFamily: bebas, fontSize: 18, letterSpacing: 3, cursor: 'pointer', borderRadius: 999, display: 'inline-block', minWidth: 260, textAlign: 'center', textDecoration: 'none' }}
      >
        KIES EEN ABONNEMENT
      </a>
    </div>
  )
}
