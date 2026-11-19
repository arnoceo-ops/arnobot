import { describe, it, expect, afterEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  MAAND_GRENZEN, VOICE_USD_PER_1000_TEKENS, beoordeelMaandKosten, beurtKostenUsd, bouwMeldingTekst, bouwRemTekst, haalMaandKosten,
  maandKostenUitgezonderd, maandSleutel, meldEenmaligPerMaand, voiceKostenUsd,
} from './maandKosten'
import { MANUAL_TEST_USER_ID } from './internalTestAccounts'
import type { ChatVerbruik } from './chatVerbruik'

afterEach(() => { vi.unstubAllEnvs() })

const verbruik = (extra: Partial<ChatVerbruik> = {}): ChatVerbruik =>
  ({ invoer: 0, cache_schrijven: 0, cache_lezen: 0, uitvoer: 0, aanroepen: 1, bijlagen: 1, ...extra })

describe('grenzen per plan (besluit Arno 2026-11-19)', () => {
  it('Pro melding 6 en rem 12, Basic melding 3 en rem 6', () => {
    expect(MAAND_GRENZEN.premium).toEqual({ melding: 6, rem: 12 })
    expect(MAAND_GRENZEN.team).toEqual({ melding: 6, rem: 12 })
    expect(MAAND_GRENZEN.basis).toEqual({ melding: 3, rem: 6 })
  })
  it('beoordeelt ok, melding en rem op de grens zelf', () => {
    expect(beoordeelMaandKosten(5.99, 'premium')).toBe('ok')
    expect(beoordeelMaandKosten(6, 'premium')).toBe('melding')
    expect(beoordeelMaandKosten(11.99, 'premium')).toBe('melding')
    expect(beoordeelMaandKosten(12, 'premium')).toBe('rem')
    expect(beoordeelMaandKosten(2.99, 'basis')).toBe('ok')
    expect(beoordeelMaandKosten(3, 'basis')).toBe('melding')
    expect(beoordeelMaandKosten(6, 'basis')).toBe('rem')
  })
  it('een onbekend plan valt terug op de strengste grenzen (Basic)', () => {
    expect(beoordeelMaandKosten(6, 'iets-anders')).toBe('rem')
  })
})

describe('kosten', () => {
  it('rekent een beurt zonder lezer tegen het Sonnet-tarief', () => {
    // 1M invoer à $3 + 1M uitvoer à $15
    expect(beurtKostenUsd(verbruik({ invoer: 1_000_000, uitvoer: 1_000_000 }))).toBeCloseTo(18, 6)
  })
  it('telt de lezer apart tegen het Haiku-tarief erbij', () => {
    const v = verbruik({ lezer: { invoer: 1_000_000, cache_schrijven: 0, cache_lezen: 1_000_000, uitvoer: 1_000_000, aanroepen: 2 } })
    // lezer: $1 + 1M cache lezen à 0,1 x $1 + 1M uitvoer à $5 = 6,1; hoofd 0
    expect(beurtKostenUsd(v)).toBeCloseTo(6.1, 6)
  })
  it('geeft 0 bij een ontbrekend verbruik', () => {
    expect(beurtKostenUsd(null)).toBe(0)
    expect(beurtKostenUsd(undefined)).toBe(0)
  })
  it('rekent voice tegen het ElevenLabs-tarief per 1.000 tekens', () => {
    expect(voiceKostenUsd(60_000)).toBeCloseTo(60 * VOICE_USD_PER_1000_TEKENS, 6)
    expect(voiceKostenUsd(60_000)).toBeCloseTo(9.96, 2)
  })
})

describe('uitzonderingen en maandsleutel', () => {
  it('eigenaar en interne testaccounts vallen buiten de rem, een gewone gebruiker niet', () => {
    vi.stubEnv('ARNOBOT_OWNER_USER_ID', 'user_eigenaar')
    expect(maandKostenUitgezonderd('user_eigenaar')).toBe(true)
    expect(maandKostenUitgezonderd(MANUAL_TEST_USER_ID)).toBe(true)
    expect(maandKostenUitgezonderd('user_gewoon')).toBe(false)
  })
  it('gebruikt de Amsterdamse kalendermaand, ook vlak voor en na middernacht', () => {
    expect(maandSleutel(new Date('2026-11-30T22:30:00Z'))).toBe('2026-11')
    expect(maandSleutel(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12')
  })
})

function nepDb(tabellen: Record<string, unknown[]>): { db: SupabaseClient; vragen: { tabel: string; filters: string[] }[] } {
  const vragen: { tabel: string; filters: string[] }[] = []
  const db = {
    from(tabel: string) {
      const q = { tabel, filters: [] as string[] }
      vragen.push(q)
      const keten: Record<string, unknown> = {
        select: () => keten,
        eq: (k: string, w: unknown) => { q.filters.push(`eq ${k} ${String(w)}`); return keten },
        gte: (k: string) => { q.filters.push(`gte ${k}`); return keten },
        filter: (k: string, op: string, w: string) => { q.filters.push(`filter ${k} ${op} ${w}`); return keten },
        order: () => keten,
        range: async (van: number, tot: number) => ({ data: (tabellen[tabel] ?? []).slice(van, tot + 1), error: null }),
      }
      return keten
    },
  }
  return { db: db as unknown as SupabaseClient, vragen }
}

describe('haalMaandKosten', () => {
  it('telt documenten en voice op en filtert op gebruiker, maand en beurten met een bijlage', async () => {
    const { db, vragen } = nepDb({
      arnobot_rds_logs: [{ verbruik: verbruik({ invoer: 1_000_000 }) }, { verbruik: verbruik({ uitvoer: 100_000 }) }],
      arnobot_elevenlabs_usage: [{ char_count: 30_000 }, { char_count: 10_000 }, { char_count: null }],
    })
    const k = await haalMaandKosten(db, 'user_a', new Date('2026-11-19T12:00:00Z'))
    expect(k.voiceTekens).toBe(40_000)
    expect(k.docsUsd).toBeCloseTo(3 + 1.5, 6)
    expect(k.voiceUsd).toBeCloseTo(40 * VOICE_USD_PER_1000_TEKENS, 6)
    expect(k.totaalUsd).toBeCloseTo(k.docsUsd + k.voiceUsd, 6)
    const logs = vragen.find(v => v.tabel === 'arnobot_rds_logs')!
    expect(logs.filters).toContain('eq user_id user_a')
    expect(logs.filters).toContain('gte created_at')
    expect(logs.filters).toContain('filter verbruik->>bijlagen gt 0')
    expect(vragen.find(v => v.tabel === 'arnobot_elevenlabs_usage')!.filters).toContain('eq user_id user_a')
  })
  it('geeft nul zonder rijen', async () => {
    const { db } = nepDb({})
    expect(await haalMaandKosten(db, 'user_a')).toEqual({ docsUsd: 0, voiceTekens: 0, voiceUsd: 0, totaalUsd: 0 })
  })
})

describe('bouwRemTekst', () => {
  it('is leeg zonder documenten', () => {
    expect(bouwRemTekst([])).toBe('')
  })
  it('noemt de bestanden, zegt dat ze nu niet te lezen zijn en bevat geen bedragen', () => {
    const t = bouwRemTekst([{ naam: 'plan.pdf' }, { naam: 'offerte.docx' }])
    expect(t).toContain('"plan.pdf", "offerte.docx"')
    expect(t).toContain('niet lezen')
    expect(t).toContain('eerste van volgende maand')
    expect(t).not.toMatch(/\$|euro|dollar/i)
  })
  it('geeft een samenvatting mee als die er is, ingekort', () => {
    const t = bouwRemTekst([{ naam: 'plan.pdf', samenvatting: 'x'.repeat(3000) }, { naam: 'b.pdf', samenvatting: null }])
    expect(t).toContain('Samenvatting van "plan.pdf"')
    expect(t).not.toContain('Samenvatting van "b.pdf"')
    expect(t.length).toBeLessThan(2500)
  })
})

describe('melding aan Arno', () => {
  const k = { docsUsd: 4, voiceTekens: 15_000, voiceUsd: 2.5, totaalUsd: 6.5 }
  it('bevat de gebruikers-ID, plan, bedragen en drempels, maar geen naam of e-mail', () => {
    const t = bouwMeldingTekst('user_abc', 'premium', k)
    expect(t).toContain('user_abc')
    expect(t).toContain('$6.50')
    expect(t).toContain('documenten $4.00')
    expect(t).toContain('voice $2.50')
    expect(t).toContain('rem bij $12')
  })
  it('stuurt hooguit één melding per gebruiker per maand', async () => {
    const gezien = new Set<string>()
    const store = { set: async (s: string) => (gezien.has(s) ? null : (gezien.add(s), 'OK')) }
    const stuur = vi.fn(async () => {})
    const nu = new Date('2026-11-19T12:00:00Z')
    expect(await meldEenmaligPerMaand(store, stuur, 'user_a', 'premium', k, nu)).toBe(true)
    expect(await meldEenmaligPerMaand(store, stuur, 'user_a', 'premium', k, nu)).toBe(false)
    expect(await meldEenmaligPerMaand(store, stuur, 'user_b', 'premium', k, nu)).toBe(true)
    expect(await meldEenmaligPerMaand(store, stuur, 'user_a', 'premium', k, new Date('2026-12-02T12:00:00Z'))).toBe(true)
    expect(stuur).toHaveBeenCalledTimes(3)
  })
  it('een fout in de opslag of in Telegram laat niets falen', async () => {
    const kapot = { set: async () => { throw new Error('redis weg') } }
    expect(await meldEenmaligPerMaand(kapot, async () => {}, 'user_a', 'basis', k)).toBe(false)
    const telegramKapot = vi.fn(async () => { throw new Error('telegram weg') })
    expect(await meldEenmaligPerMaand({ set: async () => 'OK' }, telegramKapot, 'user_a', 'basis', k)).toBe(false)
  })
})
