/**
 * Verwijzing naar een gebruiker voor een Telegram-melding: zonder naam of e-mailadres. De link opent de admin met de
 * gebruiker ingevuld, daar staat de naam.
 */
export function wieRef(userId: string): string {
  return `${userId}\nhttps://www.arno.bot/bot/admin?user=${encodeURIComponent(userId)}`
}
