import { randomBytes } from 'crypto'
import { getBlogDb } from './blog'
import { normalizeTags, normalizeVoornaam } from './blogText'

// Abonneebeheer voor de blogmails. Alleen vanuit server-code importeren.
// Statussen: pending (aangemeld, nog niet bevestigd), confirmed (ontvangt mail),
// unsubscribed. Alleen de bevestigingsklik in de mail zet iemand op confirmed (double opt-in).

export const SITE_URL = 'https://www.arno.bot'

export function newToken(): string {
  return randomBytes(24).toString('base64url')
}

// Tokens zijn 24 willekeurige bytes in base64url (32 tekens). Vorm eerst controleren voordat
// we de database raadplegen.
export const isTokenShape = (t: string): boolean => /^[A-Za-z0-9_-]{20,64}$/.test(t)

// Link in de bevestigingsmail: een klik van een mens bevestigt direct (api/blog/bevestig), een
// scanner komt op de pagina /blog/bevestig/[token] met een knop terecht.
export const confirmUrl = (token: string) => `${SITE_URL}/api/blog/bevestig?token=${token}`
export const unsubscribeUrl = (token: string) => `${SITE_URL}/blog/afmelden/${token}`
export const preferencesUrl = (token: string) => `${SITE_URL}/blog/voorkeuren/${token}`
// Eén-klik-afmelden voor mailclients (RFC 8058 List-Unsubscribe-Post): POST zonder pagina.
export const oneClickUnsubscribeUrl = (token: string) => `${SITE_URL}/api/blog/unsubscribe?token=${token}`

// E-mailadressen worden altijd als kleine letters opgeslagen (de unieke index op lower(email)
// vangt dubbelen af), dus opzoeken kan met een gewone gelijkheidsvergelijking.
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

interface SubscriberRow {
  id: string
  email: string
  status: 'pending' | 'confirmed' | 'unsubscribed'
  voornaam: string | null
  confirm_token: string
  unsubscribe_token: string
}

// Uitkomst van een aanmelding: 'bevestig' (nieuw, in afwachting of opnieuw aangemeld: stuur de
// bevestigingsmail) of 'bestaand' (al bevestigd: stuur het mailtje "je staat al op de lijst").
// Beide krijgen een mail, en de aanroeper antwoordt in alle gevallen hetzelfde, zodat niet te
// achterhalen is welke adressen al op de lijst staan.
export type SubscriptionRequestResult =
  | { type: 'bevestig'; email: string; confirmToken: string; voornaam: string | null }
  | { type: 'bestaand'; email: string; unsubscribeToken: string; voornaam: string | null }

export async function requestSubscription(
  rawEmail: string,
  rawTopics: unknown,
  rawVoornaam?: unknown
): Promise<SubscriptionRequestResult> {
  const db = getBlogDb()
  const email = normalizeEmail(rawEmail)
  const topics = normalizeTags(rawTopics)
  const voornaam = normalizeVoornaam(rawVoornaam)

  const find = async (): Promise<SubscriberRow | null> => {
    const { data } = await db
      .from('arnobot_blog_subscribers')
      .select('id, email, status, voornaam, confirm_token, unsubscribe_token')
      .eq('email', email)
      .maybeSingle()
    return (data as SubscriberRow | null) ?? null
  }

  let existing = await find()

  if (!existing) {
    const { error } = await db.from('arnobot_blog_subscribers').insert({
      email,
      status: 'pending',
      topics,
      voornaam,
      confirm_token: newToken(),
      unsubscribe_token: newToken(),
    })
    // Twee gelijktijdige aanmeldingen voor hetzelfde adres: de tweede botst op de unieke index.
    if (error && error.code !== '23505') throw new Error(`Aanmelden mislukt: ${error.message}`)
    existing = await find()
    if (!existing) throw new Error('Aanmelding niet teruggevonden')
    await db.from('arnobot_blog_subscribers').update({ confirm_sent_at: new Date().toISOString() }).eq('id', existing.id)
    return { type: 'bevestig', email: existing.email, confirmToken: existing.confirm_token, voornaam: existing.voornaam }
  }

  if (existing.status === 'confirmed') {
    return { type: 'bestaand', email: existing.email, unsubscribeToken: existing.unsubscribe_token, voornaam: existing.voornaam }
  }

  // pending of eerder afgemeld: opnieuw bevestigen met een vers bevestigtoken. Het afmeldtoken
  // blijft gelijk, zodat oude mails blijven werken.
  const confirm_token = newToken()
  const { error } = await db
    .from('arnobot_blog_subscribers')
    .update({
      status: 'pending',
      topics,
      // Een eerder ingevulde naam blijft staan als de bezoeker het veld nu leeg laat.
      voornaam: voornaam ?? existing.voornaam,
      confirm_token,
      confirm_sent_at: new Date().toISOString(),
      unsubscribed_at: null,
    })
    .eq('id', existing.id)
  if (error) throw new Error(`Aanmelden mislukt: ${error.message}`)
  return { type: 'bevestig', email: existing.email, confirmToken: confirm_token, voornaam: voornaam ?? existing.voornaam }
}

export async function confirmSubscription(token: string): Promise<'ok' | 'invalid'> {
  const db = getBlogDb()
  const { data } = await db
    .from('arnobot_blog_subscribers')
    .select('id, status')
    .eq('confirm_token', token)
    .maybeSingle()
  if (!data) return 'invalid'
  const row = data as { id: string; status: string }
  if (row.status === 'confirmed') return 'ok'
  // Een afgemeld adres wordt niet stilletjes weer actief via een oude bevestiglink.
  if (row.status !== 'pending') return 'invalid'
  const { error } = await db
    .from('arnobot_blog_subscribers')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('status', 'pending')
  return error ? 'invalid' : 'ok'
}

export async function unsubscribeByToken(token: string): Promise<'ok' | 'invalid'> {
  const db = getBlogDb()
  const { data } = await db
    .from('arnobot_blog_subscribers')
    .select('id, status')
    .eq('unsubscribe_token', token)
    .maybeSingle()
  if (!data) return 'invalid'
  const row = data as { id: string; status: string }
  if (row.status !== 'unsubscribed') {
    const { error } = await db
      .from('arnobot_blog_subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) return 'invalid'
  }
  // Wachtende bezorgingen vervallen: een afmelding werkt direct, ook voor al ingeplande mails.
  await db.from('arnobot_blog_deliveries').delete().eq('subscriber_id', row.id).eq('status', 'queued')
  return 'ok'
}

export async function getPreferences(token: string): Promise<{ topics: string[] } | null> {
  const { data } = await getBlogDb()
    .from('arnobot_blog_subscribers')
    .select('topics, status')
    .eq('unsubscribe_token', token)
    .maybeSingle()
  const row = data as { topics: string[]; status: string } | null
  if (!row || row.status !== 'confirmed') return null
  return { topics: row.topics ?? [] }
}

export async function updatePreferences(token: string, rawTopics: unknown): Promise<'ok' | 'invalid'> {
  const db = getBlogDb()
  const { data } = await db
    .from('arnobot_blog_subscribers')
    .update({ topics: normalizeTags(rawTopics) })
    .eq('unsubscribe_token', token)
    .eq('status', 'confirmed')
    .select('id')
    .maybeSingle()
  return data ? 'ok' : 'invalid'
}

// Harde bounce of spamklacht: direct afmelden, anders blijven we een adres mailen dat onze
// reputatie als afzender schaadt.
export async function suppressEmail(rawEmail: string): Promise<void> {
  const db = getBlogDb()
  const email = normalizeEmail(rawEmail)
  const { data } = await db
    .from('arnobot_blog_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('email', email)
    .neq('status', 'unsubscribed')
    .select('id')
  for (const row of (data ?? []) as { id: string }[]) {
    await db.from('arnobot_blog_deliveries').delete().eq('subscriber_id', row.id).eq('status', 'queued')
  }
}
