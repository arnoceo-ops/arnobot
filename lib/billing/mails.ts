import { billingDb } from './db'
import { getEmailTemplate, isValidEmail, type BillingMailOptions, type EmailType } from '@/lib/email-templates'
import { verstuurMail } from '@/lib/mail'

/** Lid van een team zonder er manager van te zijn. Lukt het opzoeken niet, dan nee: de mail gaat altijd door. */
export async function isGewoonTeamlid(userId: string): Promise<boolean> {
  try {
    const { data } = await billingDb.from('arnobot_team_members').select('role').eq('user_id', userId).limit(10)
    return !!data?.length && !data.some(l => l.role === 'manager')
  } catch {
    return false
  }
}

// Transactionele billing-mails (geen opt-out nodig, zie CLAUDE.md "Marketing vs.
// transactioneel"). Faalt stil: een mislukte mail mag een betaalverwerking nooit breken.
export async function verstuurBillingMail(
  userId: string,
  type: EmailType,
  billing: BillingMailOptions,
): Promise<boolean> {
  try {
    const { data: user } = await billingDb
      .from('approved_users')
      .select('voornaam, email')
      .eq('user_id', userId)
      .maybeSingle()
    if (!user || !isValidEmail(user.email)) return false
    const { subject, html } = getEmailTemplate(type, user.voornaam || 'daar', false, { userId, billing, zonderTegoedZin: await isGewoonTeamlid(userId) })
    await verstuurMail({ from: 'ArnoBot <info@arno.bot>', to: user.email, subject, html })
    return true
  } catch (e) {
    console.error('[billing/mails]', type, e instanceof Error ? e.message : e)
    return false
  }
}
