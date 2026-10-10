import { getBlogDb } from './blog'

// Registreert openen en doorklikken van een blogmail, per bezorging (en dus per abonnee).
// Aangeroepen door de Resend-webhook (app/api/webhooks/resend). Events voor mails die geen
// blogbezorging zijn (bevestigingsmails, betalingsmails) worden genegeerd.
//
// Het opslaan is een lees-en-bijwerk met controle op de oude waarde, met een paar nieuwe
// pogingen: twee events voor dezelfde mail kort na elkaar (een open en een klik) overschrijven
// elkaar zo niet.

type Kind = 'opened' | 'clicked'

interface Row {
  id: string
  opened_count: number
  first_opened_at: string | null
  clicked_count: number
  first_clicked_at: string | null
}

export async function recordMailEvent(emailId: string, kind: Kind, at: string, link?: string | null): Promise<boolean> {
  const db = getBlogDb()
  const when = Number.isNaN(Date.parse(at)) ? new Date().toISOString() : new Date(at).toISOString()

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data } = await db
      .from('arnobot_blog_deliveries')
      .select('id, opened_count, first_opened_at, clicked_count, first_clicked_at')
      .eq('resend_id', emailId)
      .maybeSingle()
    const row = data as Row | null
    if (!row) return false

    const patch =
      kind === 'opened'
        ? { opened_count: row.opened_count + 1, first_opened_at: row.first_opened_at ?? when, last_opened_at: when }
        : {
            clicked_count: row.clicked_count + 1,
            first_clicked_at: row.first_clicked_at ?? when,
            last_clicked_at: when,
            last_clicked_link: link ? link.slice(0, 500) : null,
          }

    const { data: updated } = await db
      .from('arnobot_blog_deliveries')
      .update(patch)
      .eq('id', row.id)
      .eq(kind === 'opened' ? 'opened_count' : 'clicked_count', kind === 'opened' ? row.opened_count : row.clicked_count)
      .select('id')
      .maybeSingle()
    if (updated) return true
  }
  return false
}
