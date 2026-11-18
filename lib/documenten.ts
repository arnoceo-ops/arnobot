// Databasecode voor documenten (docs/DOCUMENTEN_PLAN.md). De Supabase-client komt als parameter binnen, zodat
// de tests een nagemaakte client kunnen meegeven. Elke query op arnobot_documenten gaat met een
// eigenaarsfilter (user_id); een document-ID of pad uit de client wordt hier nooit zonder dat filter gebruikt.
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildDocumentContentBlock } from './documentInhoud'
import {
  DOCUMENTEN_BUCKET, MAX_DOCUMENT_BYTES, isGeldigDocumentPad, schoneBestandsnaam, verloopOp,
} from './documentenRegels'
import type { GeladenBijlage, SamenstelRij } from './documentenSamenstellen'

export type DocumentRij = SamenstelRij & {
  user_id: string
  session_id: string | null
  soort: 'document' | 'transcript'
  media_type: string
  bytes: number
  storage_path: string | null
  samenvatting: string | null
  laatst_gebruikt: string
  verwijderd_op: string | null
}

const KOLOMMEN =
  'id, user_id, session_id, naam, soort, media_type, bytes, storage_path, tekst_cache, samenvatting, bewaard, created_at, laatst_gebruikt, verloopt_op, verwijderd_op'

/** Alle documenten van één gesprek van één gebruiker, in uploadvolgorde. */
export async function laadSessieDocumenten(db: SupabaseClient, userId: string, sessionId: string): Promise<DocumentRij[]> {
  const { data, error } = await db
    .from('arnobot_documenten')
    .select(KOLOMMEN)
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`documenten laden mislukt: ${error.message}`)
  return (data ?? []) as DocumentRij[]
}

/** Bytes uit de documentenbucket. Weigert elk pad dat niet precies `<eigen userId>/<uuid>.<ext>` is. */
export async function downloadDocument(db: SupabaseClient, userId: string, pad: string): Promise<Buffer | null> {
  if (!isGeldigDocumentPad(userId, pad)) return null
  try {
    const { data, error } = await db.storage.from(DOCUMENTEN_BUCKET).download(pad)
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer())
  } catch {
    return null
  }
}

async function verwijderBestand(db: SupabaseClient, userId: string, pad: string): Promise<void> {
  if (!isGeldigDocumentPad(userId, pad)) return
  await db.storage.from(DOCUMENTEN_BUCKET).remove([pad]).catch(() => {})
}

/**
 * Een nieuwe upload in dit gesprek vastleggen als tijdelijk document. Het bestand blijft in de bucket
 * (wordt hier nooit verwijderd, behalve als het afgekeurd wordt). Een tweede aanroep met hetzelfde pad
 * (bijvoorbeeld een herhaald verzoek) maakt geen tweede rij.
 */
export async function verwerkNieuweUpload(
  db: SupabaseClient,
  p: { userId: string; sessionId: string; naam: string; mediaType: string; storagePath: string },
  nu: Date = new Date(),
): Promise<{ error: string | null }> {
  if (!isGeldigDocumentPad(p.userId, p.storagePath)) return { error: 'bestand_niet_leesbaar' }

  // Een herhaald verzoek: dit pad staat al op naam van deze gebruiker in dit gesprek.
  const { data: bestaand } = await db
    .from('arnobot_documenten')
    .select('id')
    .eq('user_id', p.userId)
    .eq('storage_path', p.storagePath)
    .maybeSingle()
  if (bestaand) return { error: null }

  const buffer = await downloadDocument(db, p.userId, p.storagePath)
  if (!buffer) return { error: 'bestand_niet_leesbaar' }
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    await verwijderBestand(db, p.userId, p.storagePath)
    return { error: 'bestand_te_groot' }
  }

  const naam = schoneBestandsnaam(p.naam)
  const inhoud = await buildDocumentContentBlock({ name: naam, mediaType: p.mediaType, data: buffer.toString('base64') })
  if (inhoud.error) {
    await verwijderBestand(db, p.userId, p.storagePath)
    return { error: inhoud.error }
  }

  const { error } = await db.from('arnobot_documenten').insert({
    user_id: p.userId,
    session_id: p.sessionId,
    naam,
    soort: 'document',
    media_type: p.mediaType,
    bytes: buffer.length,
    storage_path: p.storagePath,
    tekst_cache: inhoud.extractedText,
    bewaard: false,
    laatst_gebruikt: nu.toISOString(),
    verloopt_op: verloopOp(nu).toISOString(),
  })
  if (error && error.code !== '23505') return { error: 'document_opslaan_mislukt' }
  return { error: null }
}

/** Laadfunctie voor stelBijlagenSamen: haalt een PDF of afbeelding uit de bucket, of tekst die niet in de cache stond. */
export async function laadBijlage(db: SupabaseClient, userId: string, rij: SamenstelRij & { storage_path: string | null; media_type: string }): Promise<GeladenBijlage | null> {
  if (!rij.storage_path) return null
  const buffer = await downloadDocument(db, userId, rij.storage_path)
  if (!buffer) return null
  const r = await buildDocumentContentBlock({ name: rij.naam, mediaType: rij.media_type, data: buffer.toString('base64') })
  if (r.error) return null
  return { block: r.block, tekst: r.extractedText }
}

/**
 * Markeert documenten als gebruikt: een tijdelijk document leeft weer 48 uur vanaf nu, een bewaard document
 * krijgt alleen een nieuw "laatst gebruikt". Mislukt dit, dan gaat het gesprek gewoon door.
 */
export async function markeerGebruikt(db: SupabaseClient, userId: string, rijen: { id: string; bewaard: boolean }[], nu: Date = new Date()): Promise<void> {
  try {
    const tijdelijk = rijen.filter(r => !r.bewaard).map(r => r.id)
    const bewaard = rijen.filter(r => r.bewaard).map(r => r.id)
    if (tijdelijk.length > 0) {
      await db.from('arnobot_documenten')
        .update({ laatst_gebruikt: nu.toISOString(), verloopt_op: verloopOp(nu).toISOString() })
        .eq('user_id', userId).eq('bewaard', false).in('id', tijdelijk)
    }
    if (bewaard.length > 0) {
      await db.from('arnobot_documenten')
        .update({ laatst_gebruikt: nu.toISOString() })
        .eq('user_id', userId).eq('bewaard', true).in('id', bewaard)
    }
  } catch (e) {
    console.error('[documenten] markeerGebruikt mislukt:', e instanceof Error ? e.message : String(e))
  }
}
