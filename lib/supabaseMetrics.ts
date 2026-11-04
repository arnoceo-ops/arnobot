// Serverbelasting van de Supabase-database, uit het Prometheus-endpoint van het project. Het
// endpoint is gedocumenteerd, werkt op Pro en gebruikt de bestaande service-sleutel (basic auth),
// dus er is geen apart toegangstoken nodig. Gemeten 2026-11-04 op Micro: 948 MB totaal.

export type ServerMeting = {
  /** Aandeel gebruikt geheugen, 0 tot 1: 1 min beschikbaar gedeeld door totaal. */
  geheugenGebruikt: number | null
}

/** Leest één waarde uit Prometheus-tekst, bijvoorbeeld node_memory_MemTotal_bytes. */
export function leesWaarde(tekst: string, naam: string): number | null {
  const m = tekst.match(new RegExp(`^${naam}(?:\\{[^}]*\\})?\\s+([0-9.eE+-]+)\\s*$`, 'm'))
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

export function parseServerMeting(tekst: string): ServerMeting {
  const totaal = leesWaarde(tekst, 'node_memory_MemTotal_bytes')
  const beschikbaar = leesWaarde(tekst, 'node_memory_MemAvailable_bytes')
  if (totaal === null || beschikbaar === null || totaal <= 0) return { geheugenGebruikt: null }
  return { geheugenGebruikt: Math.min(1, Math.max(0, 1 - beschikbaar / totaal)) }
}

/** Haalt de meting op. Geeft null-waarden bij een fout: een meting mag de wacht nooit breken. */
export async function leesServerMeting(): Promise<ServerMeting> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sleutel = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !sleutel) return { geheugenGebruikt: null }
    const res = await fetch(`${url}/customer/v1/privileged/metrics`, {
      headers: { Authorization: 'Basic ' + Buffer.from(`service_role:${sleutel}`).toString('base64') },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { geheugenGebruikt: null }
    return parseServerMeting(await res.text())
  } catch {
    return { geheugenGebruikt: null }
  }
}
