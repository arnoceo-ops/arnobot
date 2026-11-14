// Wanneer is arno.bot te traag? Eén plek voor de grenzen, gebruikt door de kleur van de
// PERFORMANCE-cirkel op /bot/admin/status en door de Telegram-melding van /api/cron/storing-wacht,
// zodat kleur en waarschuwing nooit uit elkaar lopen.
//
// De metingen komen van de Instatus-monitor (responstijd van arno.bot, op afstand gemeten). Gemeten
// basis op 2026-11-14: gemiddeld 668 ms en p95 1657 ms over een week. De grenzen liggen daar ruim
// boven, zodat een normale week groen blijft en alleen een echte verslechtering kleurt:
//
//   onder druk (geel/oranje):  gemiddeld boven 1200 ms, of p95 boven 2500 ms
//   laag (rood):               gemiddeld boven 2500 ms, of p95 boven 4000 ms
//
// Bij een meting met alleen een gemiddelde (het laatste uur voor de waarschuwing, te weinig
// metingen voor een betrouwbare p95) telt alleen het gemiddelde. De grenzen zijn aan te passen
// op één plek: hieronder. De kleur hangt aan het niveau, niet aan het getal in de cirkel.

export const SNELHEID_GRENZEN = {
  onderDruk: { gemiddeldMs: 1200, p95Ms: 2500 },
  laag: { gemiddeldMs: 2500, p95Ms: 4000 },
} as const

export type SnelheidNiveau = 'goed' | 'onder_druk' | 'laag' | 'onbekend'

export type SnelheidMeting = { gemiddeldMs: number | null; p95Ms: number | null }

export function beoordeelSnelheid({ gemiddeldMs, p95Ms }: SnelheidMeting): SnelheidNiveau {
  if (gemiddeldMs === null && p95Ms === null) return 'onbekend'
  const boven = (waarde: number | null, grens: number) => waarde !== null && waarde > grens
  if (boven(gemiddeldMs, SNELHEID_GRENZEN.laag.gemiddeldMs) || boven(p95Ms, SNELHEID_GRENZEN.laag.p95Ms)) return 'laag'
  if (boven(gemiddeldMs, SNELHEID_GRENZEN.onderDruk.gemiddeldMs) || boven(p95Ms, SNELHEID_GRENZEN.onderDruk.p95Ms)) return 'onder_druk'
  return 'goed'
}

export const SNELHEID_KLEUR: Record<SnelheidNiveau, string> = {
  goed: '#22c55e',
  onder_druk: '#f59e0b',
  laag: '#cc2200',
  onbekend: '#6b7280',
}

/** Het getal in de cirkel: 100 bij een p95 van 1000 ms of sneller, lineair omlaag tot 0 bij 5000 ms. Alleen om te vullen, de kleur komt van het niveau. */
export function snelheidScore({ gemiddeldMs, p95Ms }: SnelheidMeting): number {
  const ms = p95Ms ?? gemiddeldMs
  if (ms === null) return 0
  return Math.max(0, Math.min(100, Math.round(100 - (ms - 1000) / 40)))
}

/** Gemiddelde en p95 (in ms) van een lijst responstijden. Nullen en negatieve waarden tellen niet mee. */
export function meetSnelheid(tijden: number[]): SnelheidMeting & { aantal: number } {
  const geldig = tijden.filter(t => t > 0).sort((a, b) => a - b)
  if (geldig.length === 0) return { gemiddeldMs: null, p95Ms: null, aantal: 0 }
  return {
    gemiddeldMs: Math.round(geldig.reduce((som, t) => som + t, 0) / geldig.length),
    p95Ms: geldig[Math.floor(geldig.length * 0.95)],
    aantal: geldig.length,
  }
}
