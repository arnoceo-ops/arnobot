import { Resend } from 'resend'
import { billingDb } from './db'
import { getEmailTemplate, isValidEmail, type EmailType, type TeamMailOptions } from '@/lib/email-templates'

const resend = new Resend(process.env.RESEND_API_KEY)

// Team-betaalmails, zelfde transactionele patroon als lib/billing/mails.ts (geen opt-out
// nodig). Gaat altijd naar de command_manager (teambaas), niet naar individuele teamleden.
export async function verstuurTeamMail(
  managerId: string,
  type: EmailType,
  team: TeamMailOptions,
): Promise<boolean> {
  try {
    const { data: user } = await billingDb
      .from('approved_users')
      .select('voornaam, email')
      .eq('user_id', managerId)
      .maybeSingle()
    if (!user || !isValidEmail(user.email)) return false
    const { subject, html } = getEmailTemplate(type, user.voornaam || 'daar', false, { userId: managerId, team })
    await resend.emails.send({ from: 'ArnoBot <info@arno.bot>', to: user.email, subject, html })
    return true
  } catch (e) {
    console.error('[billing/teamMails]', type, e instanceof Error ? e.message : e)
    return false
  }
}
