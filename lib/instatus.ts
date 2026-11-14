// Leest de meting van de Instatus-monitor van arno.bot (op afstand gemeten responstijd en
// bereikbaarheid). Zelfde API als /bot/admin/status. Geeft null als er geen sleutel is of de
// aanroep mislukt: een storingsmelding mag nooit zelf een storing veroorzaken.

export type InstatusLog = { createdAt: string; status: string; responseTime?: number }

export type InstatusMeting = {
  monitorStatus: string | null
  logs: InstatusLog[]
}

export async function leesInstatusMeting(): Promise<InstatusMeting | null> {
  const apiKey = process.env.INSTATUS_API_KEY?.trim()
  if (!apiKey) return null
  const headers = { Authorization: `Bearer ${apiKey}` }
  const opties = { headers, cache: 'no-store' as const, signal: AbortSignal.timeout(8000) }
  try {
    const pages = await fetch('https://api.instatus.com/v1/pages', opties).then(r => r.json())
    const pageId = Array.isArray(pages) ? pages[0]?.id : null
    if (!pageId) return null
    const md = await fetch(`https://api.instatus.com/${pageId}/monitors`, opties).then(r => r.json())
    const monitor = md?.monitors?.[0]
    if (!monitor?.id) return null
    const ld = await fetch(`https://api.instatus.com/monitors/${monitor.id}/logs?limit=1000`, opties).then(r => r.json())
    return { monitorStatus: typeof monitor.status === 'string' ? monitor.status : null, logs: Array.isArray(ld?.logs) ? ld.logs : [] }
  } catch {
    return null
  }
}
