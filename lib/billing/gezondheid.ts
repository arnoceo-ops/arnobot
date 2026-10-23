import { billingDb } from '@/lib/billing/db'
import { MollieError, mollieIngeschakeld, mollieModus, pingMollie } from '@/lib/billing/mollie'
import { MoneybirdError, moneybirdIngeschakeld, pingMoneybird } from '@/lib/billing/moneybird'

// Gezondheidscheck van de koppelingen met Mollie (betalen) en Moneybird (facturen). Alleen
// leesaanroepen: er wordt nooit een betaling of factuur aangemaakt. Gebruikt door de dagelijkse
// billing-cron (melding via Telegram bij een fout) en door de tegel op /bot/admin/status.

export type KoppelingNiveau = 'ok' | 'let-op' | 'fout'

export interface KoppelingStatus {
  naam: 'Mollie' | 'Moneybird'
  niveau: KoppelingNiveau
  beschrijving: string
  regels: string[]
  link: string
}

const TIMEOUT_MS = 8000

function metTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Geen antwoord binnen 8 seconden')), TIMEOUT_MS)),
  ])
}

function fout(e: unknown): string {
  if (e instanceof MollieError || e instanceof MoneybirdError) {
    return e.status === 401 || e.status === 403 ? 'Sleutel of token wordt geweigerd' : `Fout ${e.status}`
  }
  return e instanceof Error ? e.message : 'Onbekende fout'
}

function tijd(iso: string | null | undefined): string {
  if (!iso) return 'nog niet'
  return new Date(iso).toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

async function laatsteBetaling(): Promise<string | null> {
  const { data } = await billingDb
    .from('arnobot_payments')
    .select('betaald_at')
    .eq('status', 'paid')
    .not('betaald_at', 'is', null)
    .order('betaald_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.betaald_at as string | undefined) ?? null
}

async function laatsteFactuur(): Promise<string | null> {
  const { data } = await billingDb
    .from('arnobot_payments')
    .select('betaald_at')
    .not('moneybird_factuur_id', 'is', null)
    .order('betaald_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.betaald_at as string | undefined) ?? null
}

async function controleerMollie(): Promise<KoppelingStatus> {
  const basis = { naam: 'Mollie' as const, link: 'https://my.mollie.com/dashboard' }
  if (!mollieIngeschakeld()) {
    return { ...basis, niveau: 'fout', beschrijving: 'Niet geconfigureerd', regels: ['MOLLIE_API_KEY ontbreekt'] }
  }
  const modus = mollieModus()
  try {
    await metTimeout(pingMollie())
  } catch (e) {
    return { ...basis, niveau: 'fout', beschrijving: 'Niet bereikbaar', regels: [fout(e), `Modus: ${modus === 'live' ? 'live' : 'testmodus'}`] }
  }
  const regels = [`Modus: ${modus === 'live' ? 'live' : 'testmodus, nog niet voor gebruikers open'}`]
  try { regels.push(`Laatste betaling: ${tijd(await laatsteBetaling())}`) } catch { /* tabel niet bereikbaar, de check zelf slaagde */ }
  return {
    ...basis,
    niveau: modus === 'live' ? 'ok' : 'let-op',
    beschrijving: modus === 'live' ? 'Verbonden' : 'Verbonden, testmodus',
    regels,
  }
}

async function controleerMoneybird(): Promise<KoppelingStatus> {
  const basis = { naam: 'Moneybird' as const, link: 'https://moneybird.com' }
  if (!moneybirdIngeschakeld()) {
    return { ...basis, niveau: 'fout', beschrijving: 'Niet geconfigureerd', regels: ['Token of administratie-ID ontbreekt'] }
  }
  try {
    await metTimeout(pingMoneybird())
  } catch (e) {
    return { ...basis, niveau: 'fout', beschrijving: 'Niet bereikbaar', regels: [fout(e)] }
  }
  const regels: string[] = []
  try { regels.push(`Laatste factuur aangemaakt: ${tijd(await laatsteFactuur())}`) } catch { /* idem */ }
  return { ...basis, niveau: 'ok', beschrijving: 'Verbonden', regels }
}

export async function controleerKoppelingen(): Promise<KoppelingStatus[]> {
  return Promise.all([controleerMollie(), controleerMoneybird()])
}
