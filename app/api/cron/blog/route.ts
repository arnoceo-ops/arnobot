import { NextRequest, NextResponse } from 'next/server'
import { getBlogDb, revalidateBlog } from '@/lib/blog'
import { notifySubscribersOfPost, processBlogDeliveries } from '@/lib/blogMail'
import { notifyCronFailure } from '@/lib/cron-notify'

export const maxDuration = 120

// Elk kwartier: (1) ingeplande posts waarvan het tijdstip is bereikt publiceren, (2) voor
// gepubliceerde posts met "verstuur naar abonnees" de wachtrij vullen, (3) wachtende mails
// versturen binnen het dagbudget (lib/blogMail.ts). De wachtrij loopt zo ook door over dagen
// heen als een post niet in één dag naar alle abonnees past.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = getBlogDb()
    const nowIso = new Date().toISOString()

    const { data: due, error: dueErr } = await db
      .from('arnobot_blog_posts')
      .select('id, slug, publish_at')
      .eq('status', 'scheduled')
      .lte('publish_at', nowIso)
    if (dueErr) throw new Error(`Ingeplande posts ophalen mislukt: ${dueErr.message}`)

    let published = 0
    for (const p of (due ?? []) as { id: string; slug: string; publish_at: string }[]) {
      // Voorwaarde op status: een gelijktijdige run of een handmatige publicatie wint zonder conflict.
      const { data } = await db
        .from('arnobot_blog_posts')
        .update({ status: 'published', published_at: p.publish_at, updated_at: nowIso })
        .eq('id', p.id)
        .eq('status', 'scheduled')
        .select('id')
        .maybeSingle()
      if (data) {
        published++
        revalidateBlog(p.slug)
      }
    }

    const { data: toNotify, error: notifyErr } = await db
      .from('arnobot_blog_posts')
      .select('id, tags')
      .eq('status', 'published')
      .eq('notify_subscribers', true)
      .is('notified_at', null)
    if (notifyErr) throw new Error(`Posts om te versturen ophalen mislukt: ${notifyErr.message}`)

    let queued = 0
    for (const p of (toNotify ?? []) as { id: string; tags: string[] }[]) {
      queued += await notifySubscribersOfPost(p)
    }

    const delivery = await processBlogDeliveries()
    return NextResponse.json({ ok: true, published, queued, ...delivery })
  } catch (err) {
    console.error('[cron/blog]', err instanceof Error ? err.message : err)
    await notifyCronFailure('blog', err)
    return NextResponse.json({ error: 'Cron mislukt' }, { status: 500 })
  }
}
