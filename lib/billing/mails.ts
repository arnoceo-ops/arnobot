import { billingDb } from './db'
import { getEmailTemplate, isValidEmail, type BillingMailOptions, type EmailType } from '@/lib/email-templates'
import { verstuurMail } from '@/lib/mail'

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
    const { subject, html } = getEmailTemplate(type, user.voornaam || 'daar', false, { userId, billing })
    await verstuurMail({ from: 'ArnoBot <info@arno.bot>', to: user.email, subject, html })
    return true
  } catch (e) {
    console.error('[billing/mails]', type, e instanceof Error ? e.message : e)
    return false
  }
}
