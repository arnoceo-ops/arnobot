// De opruiming van tijdelijke documenten en achtergebleven uploads (cron /api/cron/documenten-opruimen,
// docs/DOCUMENTEN_PLAN.md). De Supabase-client komt als parameter binnen, zodat de tests een nagemaakte client
// kunnen meegeven. Dit raakt bewust alle gebruikers (het is een cron), en nooit een bewaard document.
import type { SupabaseClient } from '@supabase/supabase-js'
import { DOCUMENTEN_BUCKET, isGeldigDocumentPad } from './documentenRegels'

// Bestanden in de oude uploadbucket worden na verwerking direct verwijderd; wat daar langer dan een etmaal staat is
// een achtergebleven upload (gesloten tabblad, afgewezen verzoek, verwijderde bijlage in de chat).
const OUDE_BUCKET = 'chat-audio-uploads'
export const WEESBESTAND_LEEFTIJD_MS = 24 * 60 * 60 * 1000
export const TOMBSTONE_BEWAARTIJD_MS = 30 * 24 * 60 * 60 * 1000
export const MAX_PER_RUN = 300

export type OpruimResultaat = {
  verlopen: number
  grafstenenGewist: number
  weesbestanden: number
  fouten: string[]
}

export async function ruimDocumentenOp(db: SupabaseClient, nu: Date = new Date()): Promise<OpruimResultaat> {
  const uit: OpruimResultaat = { verlopen: 0, grafstenenGewist: 0, weesbestanden: 0, fouten: [] }
  const stappen: [string, () => Promise<void>][] = [
    ['verlopen documenten', () => ruimVerlopenOp(db, nu, uit)],
    ['oude sporen', () => wisOudeGrafstenen(db, nu, uit)],
    ['achtergebleven uploads', () => ruimWeesbestandenOp(db, nu, uit)],
  ]
  for (const [naam, stap] of stappen) {
    try { await stap() } catch (e) { uit.fouten.push(`${naam}: ${e instanceof Error ? e.message : String(e)}`) }
  }
  return uit
}

/**
 * Tijdelijke documenten voorbij hun verloopmoment: bestand weg, inhoud weg, rij blijft als "grafsteen" (alleen naam en
 * verwijderd_op). Het bestand gaat eerst: lukt dat niet, dan blijft de rij ongemoeid en probeert de volgende run het opnieuw.
 */
async function ruimVerlopenOp(db: SupabaseClient, nu: Date, uit: OpruimResultaat): Promise<void> {
  const { data, error } = await db
    .from('arnobot_documenten')
    .select('id, user_id, storage_path')
    .eq('bewaard', false)
    .is('verwijderd_op', null)
    .lte('verloopt_op', nu.toISOString())
    .order('verloopt_op', { ascending: true })
    .limit(MAX_PER_RUN)
  if (error) throw new Error(error.message)

  for (const rij of (data ?? []) as { id: string; user_id: string; storage_path: string | null }[]) {
    if (rij.storage_path) {
      if (!isGeldigDocumentPad(rij.user_id, rij.storage_path)) {
        uit.fouten.push(`document ${rij.id}: ongeldig opslagpad, overgeslagen`)
        continue
      }
      const { error: rmFout } = await db.storage.from(DOCUMENTEN_BUCKET).remove([rij.storage_path])
      if (rmFout) {
        uit.fouten.push(`document ${rij.id}: bestand verwijderen mislukt (${rmFout.message})`)
        continue
      }
    }
    const { error: upFout } = await db
      .from('arnobot_documenten')
      .update({ storage_path: null, tekst_cache: null, samenvatting: null, verwijderd_op: nu.toISOString() })
      .eq('id', rij.id)
      .eq('user_id', rij.user_id)
    if (upFout) {
      uit.fouten.push(`document ${rij.id}: rij bijwerken mislukt (${upFout.message})`)
      continue
    }
    uit.verlopen++
  }
}

/** Grafstenen ouder dan 30 dagen: ook de rij zelf gaat weg. */
async function wisOudeGrafstenen(db: SupabaseClient, nu: Date, uit: OpruimResultaat): Promise<void> {
  const grens = new Date(nu.getTime() - TOMBSTONE_BEWAARTIJD_MS).toISOString()
  const { data, error } = await db
    .from('arnobot_documenten')
    .delete()
    .not('verwijderd_op', 'is', null)
    .lt('verwijderd_op', grens)
    .select('id')
  if (error) throw new Error(error.message)
  uit.grafstenenGewist = (data ?? []).length
}

/**
 * Bestanden die langer dan een etmaal in een uploadbucket staan zonder dat iets ze nog nodig heeft. In de documentenbucket
 * is "nodig" een rij in arnobot_documenten die naar het pad verwijst; kan dat niet worden vastgesteld, dan blijft het bestand staan.
 */
async function ruimWeesbestandenOp(db: SupabaseClient, nu: Date, uit: OpruimResultaat): Promise<void> {
  const grens = nu.getTime() - WEESBESTAND_LEEFTIJD_MS
  let budget = MAX_PER_RUN

  for (const bucket of [DOCUMENTEN_BUCKET, OUDE_BUCKET]) {
    // Mappen op topniveau zijn gebruikers; in elke map staan de bestanden als <uuid>.<ext>.
    const mappen: string[] = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.storage.from(bucket).list('', { limit: 1000, offset })
      if (error) { uit.fouten.push(`${bucket}: lijst mappen mislukt (${error.message})`); break }
      for (const item of data ?? []) if (!item.id && item.name && !item.name.includes('/')) mappen.push(item.name)
      if ((data ?? []).length < 1000) break
    }

    for (const map of mappen) {
      if (budget <= 0) return
      const { data: bestanden, error } = await db.storage.from(bucket).list(map, { limit: 1000 })
      if (error) { uit.fouten.push(`${bucket}: lijst bestanden mislukt (${error.message})`); continue }
      let kandidaten = (bestanden ?? [])
        .filter(b => b.id && b.name && !b.name.includes('/') && Date.parse(b.created_at ?? '') < grens)
        .map(b => `${map}/${b.name}`)
      if (kandidaten.length === 0) continue

      if (bucket === DOCUMENTEN_BUCKET) {
        const { data: rijen, error: zoekFout } = await db
          .from('arnobot_documenten')
          .select('storage_path')
          .in('storage_path', kandidaten)
        if (zoekFout) { uit.fouten.push(`${bucket}: controle op rijen mislukt (${zoekFout.message})`); continue }
        const bezet = new Set((rijen ?? []).map((r: { storage_path: string | null }) => r.storage_path))
        kandidaten = kandidaten.filter(p => !bezet.has(p))
      }
      kandidaten = kandidaten.slice(0, budget)
      if (kandidaten.length === 0) continue

      const { error: rmFout } = await db.storage.from(bucket).remove(kandidaten)
      if (rmFout) { uit.fouten.push(`${bucket}: verwijderen mislukt (${rmFout.message})`); continue }
      uit.weesbestanden += kandidaten.length
      budget -= kandidaten.length
    }
  }
}
