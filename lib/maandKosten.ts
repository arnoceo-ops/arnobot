// Eén teller per gebruiker per kalendermaand voor wat bijlagen en gesproken antwoorden samen kosten (besluit Arno 2026-11-19, docs/DOCUMENTEN_PLAN.md):
// documenten (alleen beurten met een bijlage, uit arnobot_rds_logs.verbruik, ook de lezer) plus ElevenLabs (tekens uit arnobot_elevenlabs_usage).
// Twee drempels per plan: de melding gaat naar Arno (eenmaal per gebruiker per maand, nooit naar de gebruiker), de rem is zacht en gratis: niets
// wordt geblokkeerd, voice valt terug op tekst en een bijlage wordt niet meer gelezen tot de eerste van de volgende maand. Basic heeft geen voice,
// daar is het totaal dus alleen documenten.
import type { SupabaseClient } from '@supabase/supabase-js'
import { verbruikKostenUsd, type ChatVerbruik } from '@/lib/chatVerbruik'
import { haalAlleRijen } from '@/lib/haalAlleRijen'
import { isInternalTestUser } from '@/lib/internalTestAccounts'
import { amsterdamMaandStart } from '@/lib/voiceLimiet'

export type MaandPlan = 'basis' | 'premium' | 'team'

// Besluit Arno 2026-11-19: Pro (premium en team) melding bij $6 en rem bij $12, Basic melding bij $3 en rem bij $6, elk voor voice en documenten samen.
export const MAAND_GRENZEN: Record<MaandPlan, { melding: number; rem: number }> = {
  basis: { melding: 3, rem: 6 },
  premium: { melding: 6, rem: 12 },
  team: { melding: 6, rem: 12 },
}

// Dollars per miljoen tokens: Sonnet 4.6 (de chat) en Haiku 4.5 (de lezer, lib/documentLezer.ts).
const SONNET = { invoer: 3, uitvoer: 15 }
const HAIKU = { invoer: 1, uitvoer: 5 }
// ElevenLabs: aanname uit het tarief (zelfde getal als de plafondberekening in lib/voiceLimiet.ts), niet uit het dashboard.
export const VOICE_USD_PER_1000_TEKENS = 0.166

/** Kosten van één beurt met bijlage in dollars: het hoofdmodel plus, als de lezer is gebruikt, die aanroepen tegen het Haiku-tarief. */
export function beurtKostenUsd(v: ChatVerbruik | null | undefined): number {
  if (!v) return 0
  const hoofd = verbruikKostenUsd(v, SONNET.invoer, SONNET.uitvoer)
  const lezer = v.lezer ? verbruikKostenUsd({ ...v.lezer, bijlagen: 0 }, HAIKU.invoer, HAIKU.uitvoer) : 0
  return hoofd + lezer
}

export function voiceKostenUsd(tekens: number): number {
  return (tekens / 1000) * VOICE_USD_PER_1000_TEKENS
}

export type MaandStand = 'ok' | 'melding' | 'rem'

export function beoordeelMaandKosten(totaalUsd: number, plan: MaandPlan | string): MaandStand {
  const g = MAAND_GRENZEN[(plan as MaandPlan)] ?? MAAND_GRENZEN.basis
  if (totaalUsd >= g.rem) return 'rem'
  if (totaalUsd >= g.melding) return 'melding'
  return 'ok'
}

/** "2026-11": de kalendermaand in Amsterdamse tijd, voor de eenmalige melding per maand. */
export function maandSleutel(nu: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit' }).format(nu)
}

/** De eigenaar en de interne testaccounts blijven buiten de rem: hun eigen proeven mogen hun toegang niet afknijpen. */
export function maandKostenUitgezonderd(userId: string): boolean {
  if (isInternalTestUser(userId)) return true
  const eigenaar = process.env.ARNOBOT_OWNER_USER_ID
  return !!eigenaar && eigenaar === userId
}

export type MaandKosten = { docsUsd: number; voiceTekens: number; voiceUsd: number; totaalUsd: number }

/**
 * Wat een gebruiker deze kalendermaand (Amsterdamse tijd) aan documenten en voice heeft gekost. Gooit bij een fout in de telling: de aanroeper
 * moet dan doorgaan (een haperende database mag een beurt of voice niet stilzetten).
 */
export async function haalMaandKosten(db: SupabaseClient, userId: string, nu: Date = new Date()): Promise<MaandKosten> {
  const vanaf = amsterdamMaandStart(nu)
  const [logs, voice] = await Promise.all([
    // Alleen beurten met een bijlage: het getal staat als tekst in de jsonb, elk positief geheel getal sorteert boven '0'.
    haalAlleRijen<{ verbruik: ChatVerbruik | null }>((van, tot) =>
      db.from('arnobot_rds_logs').select('verbruik')
        .eq('user_id', userId).gte('created_at', vanaf).filter('verbruik->>bijlagen', 'gt', '0')
        .order('id', { ascending: true }).range(van, tot)),
    haalAlleRijen<{ char_count: number | null }>((van, tot) =>
      db.from('arnobot_elevenlabs_usage').select('char_count')
        .eq('user_id', userId).gte('created_at', vanaf)
        .order('id', { ascending: true }).range(van, tot)),
  ])
  const docsUsd = logs.reduce((som, r) => som + beurtKostenUsd(r.verbruik), 0)
  const voiceTekens = voice.reduce((som, r) => som + (r.char_count ?? 0), 0)
  const voiceUsd = voiceKostenUsd(voiceTekens)
  return { docsUsd, voiceTekens, voiceUsd, totaalUsd: docsUsd + voiceUsd }
}

const kort = (tekst: string, max: number): string => {
  const schoon = tekst.replace(/\s+/g, ' ').trim()
  return schoon.length > max ? schoon.slice(0, max).trimEnd() + '...' : schoon
}

/**
 * Tekst achter de vraag als de rem aan staat: de bijlagen worden niet gelezen. Het model hoort dat en zegt het eerlijk; staat er een samenvatting van
 * het bestand in Uploads, dan mag het daar alleen op bouwen. Geen bedragen in deze tekst: ArnoBot noemt geen prijzen.
 */
export function bouwRemTekst(rijen: { naam: string; samenvatting?: string | null }[]): string {
  if (rijen.length === 0) return ''
  const namen = rijen.map(r => `"${r.naam}"`).join(', ')
  const delen = [
    `[Let op: de ruimte voor bijlagen en gesproken antwoorden is voor deze maand op. Je kunt de bijlage(n) ${namen} nu niet lezen. Zeg dat eerlijk en kort tegen de gebruiker, en dat het vanaf de eerste van volgende maand weer kan. Verzin niets over de inhoud.]`,
  ]
  for (const r of rijen) {
    if (r.samenvatting) {
      delen.push(`[Samenvatting van "${r.naam}": dit is het enige dat je nu van het bestand weet, zeg dat erbij: ${kort(r.samenvatting, 1500)}]`)
    }
  }
  return '\n\n' + delen.join('\n\n')
}

/** Tekst voor de eenmalige melding aan Arno. Alleen de pseudonieme gebruikers-ID, geen naam of e-mail. */
export function bouwMeldingTekst(userId: string, plan: string, k: MaandKosten): string {
  const g = MAAND_GRENZEN[(plan as MaandPlan)] ?? MAAND_GRENZEN.basis
  return `Maandkosten bijlagen en voice: gebruiker ${userId} (${plan}) zit deze maand op $${k.totaalUsd.toFixed(2)} (documenten $${k.docsUsd.toFixed(2)}, voice $${k.voiceUsd.toFixed(2)}). Melding bij $${g.melding}, rem bij $${g.rem}.`
}

/** Wat van een Redis-client nodig is voor de eenmalige melding (Upstash geeft 'OK' bij een nieuwe sleutel en null als hij al bestond). */
export type EenmaligStore = { set(sleutel: string, waarde: string, opties: { nx: true; ex: number }): Promise<unknown> }

/**
 * Stuurt de melding aan Arno hooguit één keer per gebruiker per kalendermaand. Geeft true als er een melding is verstuurd. Een fout (Redis weg,
 * Telegram weg) laat de beurt of de voice-aanroep nooit falen.
 */
export async function meldEenmaligPerMaand(
  store: EenmaligStore,
  stuur: (tekst: string) => Promise<unknown>,
  userId: string,
  plan: string,
  kosten: MaandKosten,
  nu: Date = new Date(),
): Promise<boolean> {
  try {
    const nieuw = await store.set(`kostenmelding:${userId}:${maandSleutel(nu)}`, '1', { nx: true, ex: 40 * 86_400 })
    if (!nieuw) return false
    await stuur(bouwMeldingTekst(userId, plan, kosten))
    return true
  } catch {
    return false
  }
}
