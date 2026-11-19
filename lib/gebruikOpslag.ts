// Wegschrijven van een gemeten aanroep naar arnobot_ai_gebruik (docs/sql/2026-11-19-ai-gebruik.sql en 2026-11-19-ai-gebruik-leverancier.sql).
// Gedeeld door de Anthropic-meting (lib/anthropicClient.ts) en de meting van Voyage, transcriptie en audio (lib/externGebruik.ts).
// Fail-open: een fout bij het wegschrijven mag een aanroep nooit laten falen.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { after } from 'next/server'
import type { AiGebruikRij } from '@/lib/aiGebruik'

let db: SupabaseClient | null = null

export async function schrijfAiGebruik(rij: AiGebruikRij): Promise<void> {
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
export function houdInLeven(taak: Promise<unknown>): void {
  try {
    after(() => taak)
  } catch {
    // buiten een verzoek: niets te doen
  }
}
