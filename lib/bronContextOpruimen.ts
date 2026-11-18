// Opruiming van arnobot_rds_logs.bron_context (docs/DOCUMENTEN_PLAN.md): de volledige context die het model kreeg wordt bewaard
// voor de waarheidscontrole (die kijkt maar een week terug) en daarna niet langer dan 30 dagen. De antwoorden zelf blijven staan.
// De Supabase-client komt als parameter binnen, zodat de tests een nagemaakte client kunnen meegeven.
import type { SupabaseClient } from '@supabase/supabase-js'

export const BRON_CONTEXT_BEWAARTIJD_MS = 30 * 24 * 60 * 60 * 1000
// Een kleine groep per stap, want de ID's gaan in de adresregel van de update.
const GROEP = 200
const MAX_GROEPEN_PER_RUN = 25

export async function ruimBronContextOp(db: SupabaseClient, nu: Date = new Date()): Promise<{ geleegd: number; nogTeDoen: boolean }> {
  const grens = new Date(nu.getTime() - BRON_CONTEXT_BEWAARTIJD_MS).toISOString()
  let geleegd = 0
  for (let i = 0; i < MAX_GROEPEN_PER_RUN; i++) {
    const { data, error } = await db
      .from('arnobot_rds_logs')
      .select('id')
      .not('bron_context', 'is', null)
      .lt('created_at', grens)
      .order('created_at', { ascending: true })
      .limit(GROEP)
    if (error) throw new Error(`bron_context zoeken mislukt: ${error.message}`)
    const ids = ((data ?? []) as { id: string | number }[]).map(r => r.id)
    if (ids.length === 0) return { geleegd, nogTeDoen: false }

    const { error: upFout } = await db.from('arnobot_rds_logs').update({ bron_context: null }).in('id', ids)
    if (upFout) throw new Error(`bron_context leegmaken mislukt: ${upFout.message}`)
    geleegd += ids.length
    if (ids.length < GROEP) return { geleegd, nogTeDoen: false }
  }
  return { geleegd, nogTeDoen: true }
}
