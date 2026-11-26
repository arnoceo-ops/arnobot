import { billingDb } from './db'

/** Naam en e-mailadres voor een Telegram-melding; het user-id alleen als de gebruiker niet te vinden is. */
export async function wieIs(userId: string): Promise<string> {
  try {
    const { data } = await billingDb.from('approved_users').select('voornaam, achternaam, email').eq('user_id', userId).maybeSingle()
    const naam = [data?.voornaam, data?.achternaam].filter(Boolean).join(' ')
    if (naam && data?.email) return `${naam} (${data.email})`
    return naam || data?.email || userId
  } catch {
    return userId
  }
}
