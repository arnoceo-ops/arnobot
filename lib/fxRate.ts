// Live EUR/USD-koers voor Abacus (besloten 2026-09-29, i.p.v. de handmatig
// bijgewerkte TARIEVEN.fxRateEurUsd-constante die tot dan toe periodiek bij de
// maand-/kwartaalcheck werd gecontroleerd). Bron: Frankfurter (ECB-referentie-
// koersen, gratis, geen API-key, dagelijks bijgewerkt). v1 staat "frozen"
// (werkt nog, geen nieuwe features), v2 is de huidige/ondersteunde versie,
// geverifieerd 2026-09-29 via /v2 (root geeft {"v1":{"status":"frozen"},
// "v2":{"status":"current"}}).
//
// Los van lib/kostenTarieven.ts gehouden: dat bestand blijft puur synchrone
// tarieven/formules (ook client-side geïmporteerd), dit bestand doet de
// server-only netwerkaanroep. TARIEVEN.fxRateEurUsd blijft bestaan als
// fallback-waarde voor als de live aanroep faalt, en als de rate die gebruikt
// wordt wanneer niemand deze functie aanroept (bijv. toekomstige scripts).
import { TARIEVEN } from './kostenTarieven'

export type FxRateResult = { rate: number; live: boolean; fetchedAt: string; datum?: string }

const FRANKFURTER_URL = 'https://api.frankfurter.dev/v2/rate/EUR/USD'

// revalidate: 3600 (1 uur) is ruim genoeg: Frankfurter zelf werkt maar 1x per
// werkdag bij (ECB-publicatieritme), dagkoers-precisie is ruim voldoende voor
// een interne kostenschatting, geen reden om vaker te fetchen.
export async function getLiveFxRateEurUsd(): Promise<FxRateResult> {
  try {
    const res = await fetch(FRANKFURTER_URL, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`Frankfurter gaf status ${res.status}`)
    const data = await res.json() as { rate?: number; date?: string }
    if (typeof data.rate !== 'number' || !isFinite(data.rate) || data.rate <= 0) {
      throw new Error('Onverwacht antwoord van Frankfurter (geen geldige rate)')
    }
    return { rate: data.rate, live: true, fetchedAt: new Date().toISOString(), datum: data.date }
  } catch (err) {
    console.error('[getLiveFxRateEurUsd] live koers ophalen mislukt, val terug op TARIEVEN.fxRateEurUsd:', err)
    return { rate: TARIEVEN.fxRateEurUsd, live: false, fetchedAt: new Date().toISOString() }
  }
}
