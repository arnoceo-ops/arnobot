// Databasecode voor documenten (docs/DOCUMENTEN_PLAN.md). De Supabase-client komt als parameter binnen, zodat
// de tests een nagemaakte client kunnen meegeven. Elke query op arnobot_documenten en arnobot_document_koppelingen
// gaat met een eigenaarsfilter (user_id); een document-ID, sessie-ID of pad uit de client wordt hier nooit zonder
// dat filter en zonder controle op vorm gebruikt.
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildDocumentContentBlock } from './documentInhoud'
import {
  DOCUMENTEN_BUCKET, MAX_DOCUMENT_BYTES, QUOTA_MAX_BYTES, QUOTA_MAX_DOCUMENTEN,
  hernoemMetBehoudExtensie, isGeldigDocumentId, isGeldigDocumentPad, isGeldigSessieId, schoneBestandsnaam, verloopOp,
} from './documentenRegels'
import { bouwDocumentGeheugen, type GeladenBijlage, type SamenstelRij } from './documentenSamenstellen'

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

/** Alleen wat de lijst in Docs en de chips nodig hebben: nooit de (zware) tekst of het opslagpad. */
export type DocsLijstRij = {
  id: string
  naam: string
  soort: 'document' | 'transcript'
  media_type: string
  bytes: number
  session_id: string | null
  bewaard: boolean
  created_at: string
  laatst_gebruikt: string
  verloopt_op: string | null
}
const LIJST_KOLOMMEN = 'id, naam, soort, media_type, bytes, session_id, bewaard, created_at, laatst_gebruikt, verloopt_op'

/**
 * Alle documenten die in dit gesprek zichtbaar zijn: die in dit gesprek zijn toegevoegd plus de bewaarde documenten die de
 * gebruiker er uit Docs aan heeft gekoppeld, in volgorde van toevoegen. Twee gewone queries in plaats van een samengesteld
 * filter, zodat het sessie-ID nooit in een filtertekst terechtkomt.
 */
export async function laadSessieDocumenten(db: SupabaseClient, userId: string, sessionId: string): Promise<DocumentRij[]> {
  const eigen = await db
    .from('arnobot_documenten')
    .select(KOLOMMEN)
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (eigen.error) throw new Error(`documenten laden mislukt: ${eigen.error.message}`)
  const rijen = [...((eigen.data ?? []) as DocumentRij[])]

  const koppelingen = await db
    .from('arnobot_document_koppelingen')
    .select('document_id')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
  if (koppelingen.error) throw new Error(`koppelingen laden mislukt: ${koppelingen.error.message}`)
  const ids = ((koppelingen.data ?? []) as { document_id: string }[]).map(k => k.document_id).filter(id => !rijen.some(r => r.id === id))
  if (ids.length > 0) {
    const gekoppeld = await db.from('arnobot_documenten').select(KOLOMMEN).eq('user_id', userId).in('id', ids)
    if (gekoppeld.error) throw new Error(`gekoppelde documenten laden mislukt: ${gekoppeld.error.message}`)
    rijen.push(...((gekoppeld.data ?? []) as DocumentRij[]))
  }
  return rijen.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
}

/** Wat ArnoBot in dit gesprek kan lezen, voor de weergave (chips): zonder grafstenen en zonder inhoud. */
export async function lijstSessieDocumenten(db: SupabaseClient, userId: string, sessionId: string): Promise<DocsLijstRij[]> {
  if (!isGeldigSessieId(sessionId)) return []
  const rijen = await laadSessieDocumenten(db, userId, sessionId)
  const nu = Date.now()
  return rijen
    .filter(r => !r.verwijderd_op && (r.bewaard || !r.verloopt_op || Date.parse(r.verloopt_op) > nu))
    .map(r => ({
      id: r.id, naam: r.naam, soort: r.soort, media_type: r.media_type, bytes: r.bytes, session_id: r.session_id,
      bewaard: r.bewaard, created_at: r.created_at, laatst_gebruikt: r.laatst_gebruikt, verloopt_op: r.verloopt_op,
    }))
}

/** De bewaarde documenten van een gebruiker (de lijst in de tab Docs), nieuwste eerst. */
export async function lijstBewaardeDocumenten(db: SupabaseClient, userId: string): Promise<DocsLijstRij[]> {
  const { data, error } = await db
    .from('arnobot_documenten')
    .select(LIJST_KOLOMMEN)
    .eq('user_id', userId)
    .eq('bewaard', true)
    .is('verwijderd_op', null)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`documenten laden mislukt: ${error.message}`)
  return (data ?? []) as DocsLijstRij[]
}

/** Hoeveel een gebruiker nu in Docs bewaart (voor de grens en de regel boven de lijst). */
export async function bewaardGebruik(db: SupabaseClient, userId: string): Promise<{ aantal: number; bytes: number }> {
  const { data, error } = await db
    .from('arnobot_documenten')
    .select('bytes')
    .eq('user_id', userId)
    .eq('bewaard', true)
    .is('verwijderd_op', null)
    .limit(1000)
  if (error) throw new Error(`gebruik tellen mislukt: ${error.message}`)
  const rijen = (data ?? []) as { bytes: number }[]
  return { aantal: rijen.length, bytes: rijen.reduce((som, r) => som + (r.bytes ?? 0), 0) }
}

/** Is er in Docs nog ruimte voor een bewaard document van deze grootte? */
export async function bewaardeRuimteOver(db: SupabaseClient, userId: string, extraBytes = 0): Promise<boolean> {
  const gebruik = await bewaardGebruik(db, userId)
  return gebruik.aantal < QUOTA_MAX_DOCUMENTEN && gebruik.bytes + extraBytes <= QUOTA_MAX_BYTES
}

/**
 * Het transcript van een audio-opname vastleggen als document van dit gesprek: alleen tekst, het audiobestand wordt nooit
 * bewaard. Tijdelijk (48 uur na het laatste bericht) of, met het vinkje, bewaard in Docs. Zo kan ArnoBot het transcript
 * ook in de vervolgberichten lezen.
 */
export async function registreerTranscript(
  db: SupabaseClient,
  p: { userId: string; sessionId: string; naam: string; mediaType: string; tekst: string; bewaard: boolean },
  nu: Date = new Date(),
): Promise<{ error: string | null }> {
  const basis = p.naam.replace(/\.[A-Za-z0-9]{1,7}$/, '')
  const naam = schoneBestandsnaam(`Transcript ${basis}`)
  const bytes = Buffer.byteLength(p.tekst, 'utf8')
  if (p.bewaard && !(await bewaardeRuimteOver(db, p.userId, bytes))) return { error: 'docs_vol' }
  const { error } = await db.from('arnobot_documenten').insert({
    user_id: p.userId,
    session_id: p.sessionId,
    naam,
    soort: 'transcript',
    media_type: p.mediaType,
    bytes,
    storage_path: null,
    tekst_cache: p.tekst,
    bewaard: p.bewaard,
    laatst_gebruikt: nu.toISOString(),
    verloopt_op: p.bewaard ? null : verloopOp(nu).toISOString(),
  })
  if (error) return { error: 'document_opslaan_mislukt' }
  return { error: null }
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
 * Een nieuwe upload vastleggen. Standaard als tijdelijk document van dit gesprek; met bewaard = true als bewaard
 * document in Docs (zonder verloopmoment, binnen de grens per gebruiker). Het bestand blijft in de bucket (wordt hier
 * nooit verwijderd, behalve als het afgekeurd wordt). Een tweede aanroep met hetzelfde pad (bijvoorbeeld een herhaald
 * verzoek) maakt geen tweede rij. Zonder sessionId (direct in Docs toegevoegd) hoort het document bij geen enkel gesprek.
 */
export async function verwerkNieuweUpload(
  db: SupabaseClient,
  p: { userId: string; sessionId: string | null; naam: string; mediaType: string; storagePath: string; bewaard?: boolean },
  nu: Date = new Date(),
): Promise<{ error: string | null }> {
  if (!isGeldigDocumentPad(p.userId, p.storagePath)) return { error: 'bestand_niet_leesbaar' }
  const bewaard = p.bewaard === true

  // Een herhaald verzoek: dit pad staat al op naam van deze gebruiker.
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

  // Docs vol: het bestand blijft staan zodat de gebruiker het zonder bewaren nog kan versturen (de opruiming haalt het
  // anders na een etmaal weg).
  if (bewaard && !(await bewaardeRuimteOver(db, p.userId, buffer.length))) return { error: 'docs_vol' }

  const { error } = await db.from('arnobot_documenten').insert({
    user_id: p.userId,
    session_id: p.sessionId,
    naam,
    soort: 'document',
    media_type: p.mediaType,
    bytes: buffer.length,
    storage_path: p.storagePath,
    tekst_cache: inhoud.extractedText,
    bewaard,
    laatst_gebruikt: nu.toISOString(),
    verloopt_op: bewaard ? null : verloopOp(nu).toISOString(),
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

// ---- Beheer vanuit de tab Docs ----

type Uitkomst = { error: string | null }

/** Hernoemt een bewaard document; de extensie blijft staan. */
export async function hernoemDocument(db: SupabaseClient, userId: string, id: unknown, invoer: unknown): Promise<Uitkomst & { naam?: string }> {
  if (!isGeldigDocumentId(id)) return { error: 'ongeldig_id' }
  const { data } = await db
    .from('arnobot_documenten')
    .select('naam')
    .eq('user_id', userId)
    .eq('id', id)
    .eq('bewaard', true)
    .is('verwijderd_op', null)
    .maybeSingle()
  if (!data) return { error: 'niet_gevonden' }
  const nieuw = hernoemMetBehoudExtensie((data as { naam: string }).naam, invoer)
  if (!nieuw) return { error: 'naam_leeg' }
  const { error } = await db.from('arnobot_documenten').update({ naam: nieuw }).eq('id', id).eq('user_id', userId)
  if (error) return { error: 'opslaan_mislukt' }
  return { error: null, naam: nieuw }
}

/** Verwijdert één document van de gebruiker: eerst het bestand, dan de rij (koppelingen gaan vanzelf mee). */
export async function verwijderDocument(db: SupabaseClient, userId: string, id: unknown): Promise<Uitkomst> {
  if (!isGeldigDocumentId(id)) return { error: 'ongeldig_id' }
  const { data } = await db
    .from('arnobot_documenten')
    .select('storage_path')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()
  if (!data) return { error: 'niet_gevonden' }
  const pad = (data as { storage_path: string | null }).storage_path
  if (pad) {
    if (!isGeldigDocumentPad(userId, pad)) return { error: 'ongeldig_pad' }
    const { error: rmFout } = await db.storage.from(DOCUMENTEN_BUCKET).remove([pad])
    if (rmFout) return { error: 'bestand_verwijderen_mislukt' }
  }
  const { error } = await db.from('arnobot_documenten').delete().eq('id', id).eq('user_id', userId)
  if (error) return { error: 'verwijderen_mislukt' }
  return { error: null }
}

/**
 * Alles van één gebruiker weg: bewaarde en tijdelijke documenten, bestanden en koppelingen. Voor "verwijder alles" in het account
 * en voor accountverwijdering. Faalt het verwijderen van bestanden, dan blijven de rijen staan zodat het opnieuw kan.
 */
export async function verwijderGebruikersDocumenten(db: SupabaseClient, userId: string): Promise<Uitkomst & { aantal: number }> {
  const { data, error } = await db
    .from('arnobot_documenten')
    .select('id, storage_path')
    .eq('user_id', userId)
    .limit(1000)
  if (error) return { error: 'laden_mislukt', aantal: 0 }
  const rijen = (data ?? []) as { id: string; storage_path: string | null }[]
  const paden = rijen.map(r => r.storage_path).filter((p): p is string => !!p && isGeldigDocumentPad(userId, p))
  for (let i = 0; i < paden.length; i += 100) {
    const { error: rmFout } = await db.storage.from(DOCUMENTEN_BUCKET).remove(paden.slice(i, i + 100))
    if (rmFout) return { error: 'bestand_verwijderen_mislukt', aantal: 0 }
  }
  const { error: delFout } = await db.from('arnobot_documenten').delete().eq('user_id', userId)
  if (delFout) return { error: 'verwijderen_mislukt', aantal: 0 }
  return { error: null, aantal: rijen.length }
}

/** Het bestand van een bewaard document om te downloaden. Een transcript heeft geen bestand en wordt een tekstbestand. */
export async function downloadBewaardDocument(db: SupabaseClient, userId: string, id: unknown): Promise<{ naam: string; mediaType: string; buffer: Buffer } | null> {
  if (!isGeldigDocumentId(id)) return null
  const { data } = await db
    .from('arnobot_documenten')
    .select(KOLOMMEN)
    .eq('user_id', userId)
    .eq('id', id)
    .eq('bewaard', true)
    .is('verwijderd_op', null)
    .maybeSingle()
  const rij = data as DocumentRij | null
  if (!rij) return null
  if (rij.storage_path) {
    const buffer = await downloadDocument(db, userId, rij.storage_path)
    return buffer ? { naam: rij.naam, mediaType: rij.media_type, buffer } : null
  }
  if (rij.tekst_cache === null || rij.tekst_cache === undefined) return null
  return { naam: rij.naam.endsWith('.txt') ? rij.naam : `${rij.naam}.txt`, mediaType: 'text/plain', buffer: Buffer.from(rij.tekst_cache, 'utf-8') }
}

// ---- Documenten uit Docs in een gesprek ----

/** Koppelt een bewaard document aan een gesprek, zodat ArnoBot het daar leest. Alleen eigen, bewaarde, niet verwijderde documenten. */
export async function koppelDocument(db: SupabaseClient, userId: string, documentId: unknown, sessionId: unknown): Promise<Uitkomst & { document?: { id: string; naam: string; soort: string } }> {
  if (!isGeldigDocumentId(documentId) || !isGeldigSessieId(sessionId)) return { error: 'ongeldig_id' }
  const { data } = await db
    .from('arnobot_documenten')
    .select('id, naam, soort')
    .eq('user_id', userId)
    .eq('id', documentId)
    .eq('bewaard', true)
    .is('verwijderd_op', null)
    .maybeSingle()
  if (!data) return { error: 'niet_gevonden' }
  const { error } = await db
    .from('arnobot_document_koppelingen')
    .upsert({ document_id: documentId, user_id: userId, session_id: sessionId }, { onConflict: 'document_id,session_id', ignoreDuplicates: true })
  if (error) return { error: 'koppelen_mislukt' }
  return { error: null, document: data as { id: string; naam: string; soort: string } }
}

export async function ontkoppelDocument(db: SupabaseClient, userId: string, documentId: unknown, sessionId: unknown): Promise<Uitkomst> {
  if (!isGeldigDocumentId(documentId) || !isGeldigSessieId(sessionId)) return { error: 'ongeldig_id' }
  const { error } = await db
    .from('arnobot_document_koppelingen')
    .delete()
    .eq('user_id', userId)
    .eq('document_id', documentId)
    .eq('session_id', sessionId)
  if (error) return { error: 'ontkoppelen_mislukt' }
  return { error: null }
}

// ---- Gesprekken met een bestand ----

export type DocGesprek = { sessie: string; datum: string; titel: string | null }

/**
 * Per document de gesprekken waarin het is gebruikt: het gesprek waarin het is toegevoegd plus elk gesprek waarin de gebruiker het
 * later koos uit Uploads of via BESPREEK, nieuwste eerst. De titel is die uit het archief; een gesprek dat nog niet is afgesloten
 * heeft nog geen titel (null). Een gesprek dat de gebruiker heeft verwijderd staat er niet in, want daar kan hij niet meer naartoe.
 * Alle queries met eigenaarsfilter, sessie-ID's eerst op vorm gecontroleerd.
 */
export async function gesprekkenPerDocument(
  db: SupabaseClient,
  userId: string,
  docs: { id: string; session_id: string | null; created_at: string }[],
): Promise<Record<string, DocGesprek[]>> {
  const uit: Record<string, DocGesprek[]> = {}
  if (docs.length === 0) return uit
  for (const d of docs) uit[d.id] = []

  const koppelingen = await db
    .from('arnobot_document_koppelingen')
    .select('document_id, session_id, created_at')
    .eq('user_id', userId)
    .in('document_id', docs.map(d => d.id))
  if (koppelingen.error) throw new Error(`koppelingen laden mislukt: ${koppelingen.error.message}`)

  const toevoegen = (docId: string, sessie: string | null, datum: string) => {
    if (!isGeldigSessieId(sessie) || !uit[docId] || uit[docId].some(g => g.sessie === sessie)) return
    uit[docId].push({ sessie, datum, titel: null })
  }
  for (const d of docs) toevoegen(d.id, d.session_id, d.created_at)
  for (const k of (koppelingen.data ?? []) as { document_id: string; session_id: string; created_at: string }[]) {
    toevoegen(k.document_id, k.session_id, k.created_at)
  }

  const sessieIds = [...new Set(Object.values(uit).flat().map(g => g.sessie))]
  const verwijderd = new Set<string>()
  const titels: Record<string, string> = {}
  if (sessieIds.length > 0) {
    const { data, error } = await db
      .from('arnobot_blog_sessions')
      .select('session_id, title, deleted_at')
      .eq('user_id', userId)
      .in('session_id', sessieIds)
    if (error) throw new Error(`gesprekstitels laden mislukt: ${error.message}`)
    for (const s of (data ?? []) as { session_id: string; title: string | null; deleted_at: string | null }[]) {
      if (s.deleted_at) verwijderd.add(s.session_id)
      else if (s.title) titels[s.session_id] = s.title
    }
  }

  for (const id of Object.keys(uit)) {
    uit[id] = uit[id]
      .filter(g => !verwijderd.has(g.sessie))
      .map(g => ({ ...g, titel: titels[g.sessie] ?? null }))
      .sort((a, b) => Date.parse(b.datum) - Date.parse(a.datum))
  }
  return uit
}

// ---- Geheugen over eerdere gesprekken met een bestand ----

const MAX_BESTANDEN_IN_GEHEUGEN = 3
const MAX_GESPREKKEN_PER_BESTAND = 3

/**
 * Voor een gesprek waarin bewaarde bestanden uit andere gesprekken zijn gekozen: de samenvattingen van de (hooguit drie nieuwste) eerdere
 * gesprekken over elk bestand, als tekst voor het geheugen van ArnoBot. Zoals het gewone geheugen alleen gesprekken van deze gebruiker die niet
 * zijn verwijderd en niet buiten de analyses zijn gehouden. Mislukt iets, dan komt er niets en gaat het gesprek gewoon door.
 */
export async function eerdereGesprekkenOverBestanden(db: SupabaseClient, userId: string, huidigeSessie: string, rijen: DocumentRij[]): Promise<string> {
  try {
    const kandidaten = rijen
      .filter(r => r.bewaard && !r.verwijderd_op && r.session_id !== huidigeSessie)
      .slice(0, MAX_BESTANDEN_IN_GEHEUGEN)
    if (kandidaten.length === 0) return ''

    const perDoc = await gesprekkenPerDocument(db, userId, kandidaten)
    const gekozen: Record<string, DocGesprek[]> = {}
    const ids = new Set<string>()
    for (const d of kandidaten) {
      const lijst = (perDoc[d.id] ?? []).filter(g => g.sessie !== huidigeSessie).slice(0, MAX_GESPREKKEN_PER_BESTAND)
      gekozen[d.id] = lijst
      for (const g of lijst) ids.add(g.sessie)
    }
    if (ids.size === 0) return ''

    const { data, error } = await db
      .from('arnobot_blog_sessions')
      .select('session_id, summary')
      .eq('user_id', userId)
      .in('session_id', [...ids])
      .is('deleted_at', null)
      .eq('community_excluded', false)
    if (error) return ''
    const samenvatting: Record<string, string> = {}
    for (const s of (data ?? []) as { session_id: string; summary: string | null }[]) if (s.summary) samenvatting[s.session_id] = s.summary

    return bouwDocumentGeheugen(kandidaten.map(d => ({
      naam: d.naam,
      gesprekken: (gekozen[d.id] ?? [])
        .filter(g => samenvatting[g.sessie])
        .map(g => ({ datum: g.datum, titel: g.titel, samenvatting: samenvatting[g.sessie] })),
    })))
  } catch (e) {
    console.error('[documenten] geheugen over eerdere gesprekken mislukt:', e instanceof Error ? e.message : String(e))
    return ''
  }
}
