// De enige plek waar een Anthropic-client wordt gemaakt (afgedwongen door scripts/check-ai-meter.mjs in CI). Elke client meet zijn aanroepen
// via de middleware uit lib/aiGebruik.ts en schrijft ze weg in arnobot_ai_gebruik (docs/sql/2026-11-19-ai-gebruik.sql). Geef bij een
// aanroep de gebruiker en de bron mee: client.messages.create(body, aiContext(userId, 'sparring-chat')). Zonder context blijft de aanroep
// gemeten, maar zonder gebruiker.
import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { after } from 'next/server'
import { maakAiMeter, type AiGebruikRij } from '@/lib/aiGebruik'

export { aiContext } from '@/lib/aiGebruik'

let db: SupabaseClient | null = null

async function schrijfAiGebruik(rij: AiGebruikRij): Promise<void> {
  // Geen schrijfacties in tests, en een noodschakelaar als de tabel ooit problemen geeft.
  if (process.env.VITEST || process.env.AI_METER_UIT === 'true') return
  try {
    db ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error } = await db.from('arnobot_ai_gebruik').insert(rij)
    if (error) console.error('[ai-gebruik] wegschrijven mislukt:', error.message)
  } catch (err) {
    console.error('[ai-gebruik] wegschrijven mislukt:', err instanceof Error ? err.message : err)
  }
}

// after() werkt alleen binnen een verzoek; daarbuiten (cron-script, test) draait de taak gewoon los door.
function houdInLeven(taak: Promise<unknown>): void {
  try {
    after(() => taak)
  } catch {
    // buiten een verzoek: niets te doen
  }
}

const aiMeter = maakAiMeter(schrijfAiGebruik, houdInLeven)

export function maakAnthropic(opties: ClientOptions = {}): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    ...opties,
    middleware: [...(opties.middleware ?? []), aiMeter],
  })
}
