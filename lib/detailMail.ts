import { verstuurMailZacht } from '@/lib/mail'
import { notifyTelegram } from '@/lib/cron-notify'

// Overzichten met namen of gespreksinhoud gaan per mail naar Arno (Resend staat bij de sub-verwerkers, Telegram niet).
// Telegram krijgt alleen de kop en de samenvatting zonder persoonsgegevens, plus of de mail is aangekomen.
const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function meldMetDetailMail(kop: string, samenvatting: string, details: string): Promise<void> {
  const verstuurd = await verstuurMailZacht({
    from: 'ArnoBot <noreply@arno.bot>',
    to: 'hq@arno.bot',
    subject: kop,
    html: `<pre style="font-family:monospace;font-size:14px;white-space:pre-wrap">${escapeHtml(details)}</pre>`,
  })
  await notifyTelegram(`${kop}\n${samenvatting}\n${verstuurd ? 'De details staan in je mail (hq@).' : 'De mail met details is niet aangekomen, zie Sentry.'}`)
}
