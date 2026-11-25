// Pushmeldingen naar de admin-app op Arno's telefoon (Web Push, alleen /bot/admin/mobiel). De aanmelding
// van de telefoon en de bevestiging dat een proefmelding is aangekomen staan in arnobot_meta
// (sleutel/waarde). Pas na die bevestiging nemen de pushmeldingen de Telegrammeldingen over de stippen
// over (pushActief). Is er iets mis met lezen of is de aanmelding weg, dan geldt Telegram weer.
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const SLEUTEL_ABONNEMENTEN = 'admin_push_abonnementen'
const SLEUTEL_BEVESTIGD = 'admin_push_bevestigd'
const MAX_APPARATEN = 3

export type PushAbonnement = { endpoint: string; keys: { p256dh: string; auth: string } }
export type PushBericht = { titel: string; tekst: string; tag: string }

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const publiekeSleutel = () => process.env.ADMIN_VAPID_PUBLIC_KEY?.trim() || null

export function isAbonnement(x: unknown): x is PushAbonnement {
  const a = x as PushAbonnement | null
  return typeof a?.endpoint === 'string' && a.endpoint.startsWith('https://') && a.endpoint.length < 1000
    && typeof a.keys?.p256dh === 'string' && typeof a.keys?.auth === 'string'
}

async function lees(sleutel: string): Promise<string | null> {
  const { data, error } = await db().from('arnobot_meta').select('value').eq('key', sleutel).maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.value as string | undefined) ?? null
}

async function schrijf(sleutel: string, waarde: string): Promise<void> {
  const { error } = await db().from('arnobot_meta').upsert({ key: sleutel, value: waarde }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

export async function leesAbonnementen(): Promise<PushAbonnement[]> {
  const waarde = await lees(SLEUTEL_ABONNEMENTEN)
  const lijst: unknown = waarde ? JSON.parse(waarde) : []
  return Array.isArray(lijst) ? lijst.filter(isAbonnement) : []
}

export async function voegAbonnementToe(a: PushAbonnement): Promise<void> {
  const rest = (await leesAbonnementen()).filter(x => x.endpoint !== a.endpoint)
  const schoon = { endpoint: a.endpoint, keys: { p256dh: a.keys.p256dh, auth: a.keys.auth } }
  await schrijf(SLEUTEL_ABONNEMENTEN, JSON.stringify([...rest, schoon].slice(-MAX_APPARATEN)))
}

export async function verwijderAbonnementen(endpoints: string[]): Promise<void> {
  const over = (await leesAbonnementen()).filter(x => !endpoints.includes(x.endpoint))
  await schrijf(SLEUTEL_ABONNEMENTEN, JSON.stringify(over))
}

export async function isBevestigd(): Promise<boolean> {
  return Boolean(await lees(SLEUTEL_BEVESTIGD))
}

export async function zetBevestigd(aan: boolean): Promise<void> {
  await schrijf(SLEUTEL_BEVESTIGD, aan ? new Date().toISOString() : '')
}

/** Nemen de pushmeldingen het over? Bevestigd, sleutels aanwezig en minstens één aangemelde telefoon. */
export async function pushActief(): Promise<boolean> {
  try {
    if (!publiekeSleutel() || !process.env.ADMIN_VAPID_PRIVATE_KEY) return false
    return (await isBevestigd()) && (await leesAbonnementen()).length > 0
  } catch (e) {
    console.error('[adminPush] status lezen mislukt:', e instanceof Error ? e.message : e)
    return false
  }
}

/**
 * Stuurt een melding naar alle aangemelde telefoons en geeft het aantal door de pushdienst aangenomen
 * meldingen terug. Een verlopen aanmelding (404 of 410) wordt opgeruimd.
 */
export async function stuurPush(bericht: PushBericht): Promise<number> {
  const publiek = publiekeSleutel()
  const prive = process.env.ADMIN_VAPID_PRIVATE_KEY?.trim()
  if (!publiek || !prive) return 0
  try {
    // 'subject' gaat naar de pushdienst: alleen het siteadres, geen persoonlijk mailadres.
    webpush.setVapidDetails('https://www.arno.bot', publiek, prive)
    const verlopen: string[] = []
    const gelukt = await Promise.all((await leesAbonnementen()).map(async a => {
      try {
        await webpush.sendNotification(a, JSON.stringify(bericht), { TTL: 12 * 3600, urgency: 'high', timeout: 8000 })
        return true
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) verlopen.push(a.endpoint)
        console.error('[adminPush] versturen mislukt:', code ?? (e instanceof Error ? e.message : e))
        return false
      }
    }))
    if (verlopen.length > 0) await verwijderAbonnementen(verlopen)
    return gelukt.filter(Boolean).length
  } catch (e) {
    console.error('[adminPush]', e instanceof Error ? e.message : e)
    return 0
  }
}
