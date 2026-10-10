import { createHash } from 'crypto'
import { Resend } from 'resend'
import { Redis } from '@upstash/redis'
import { getBlogDb, BLOG_BASE_URL, type BlogPost } from './blog'
import { getEmailTemplate } from './email-templates'
import {
  confirmUrl,
  oneClickUnsubscribeUrl,
  preferencesUrl,
  unsubscribeUrl,
} from './blogSubscribers'

// Verzending van de blogmails. Alleen vanuit server-code importeren.
//
// Afzender is een apart subdomein (mail.arno.bot): de reputatie van blogmails is dan
// gescheiden van de transactionele mails op arno.bot (betalingen, trial).
//
// Dagbudget: de gratis Resend-tier heeft een daglimiet die voor alle mail samen geldt. Blogmails
// gebruiken hooguit BLOG_DAILY_MAIL_BUDGET per UTC-dag, de rest blijft gereserveerd voor
// betalings- en trialmails. Wat niet past, blijft in de wachtrij en gaat de volgende dag mee.
// Na de upgrade naar Resend Pro (geen daglimiet) kan het budget omhoog via de env var.

const FROM = process.env.BLOG_MAIL_FROM ?? 'ArnoBot <blog@mail.arno.bot>'
const REPLY_TO = 'hq@arno.bot'
const MAX_ATTEMPTS = 5
const BATCH_SIZE = 100

function dailyBudget(): number {
  const n = Number(process.env.BLOG_DAILY_MAIL_BUDGET)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50
}

let _resend: Resend | null = null
function resend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

export async function sendConfirmationMail(email: string, confirmToken: string, voornaam: string | null = null): Promise<void> {
  const { subject, html } = getEmailTemplate('blog_bevestiging', voornaam ?? '', false, {
    blog: { titel: '', samenvatting: '', url: confirmUrl(confirmToken), afmeldUrl: '', voorkeurenUrl: '' },
  })
  const { error } = await resend().emails.send({ from: FROM, to: email, replyTo: REPLY_TO, subject, html })
  if (error) throw new Error(`Bevestigingsmail versturen mislukt: ${error.message}`)
}

function postMail(post: Pick<BlogPost, 'title' | 'summary' | 'slug'>, unsubscribeToken: string, isTest: boolean, voornaam: string | null = null) {
  return getEmailTemplate('blog_nieuwe_post', voornaam ?? '', isTest, {
    blog: {
      titel: post.title,
      samenvatting: post.summary,
      url: `${BLOG_BASE_URL}/blog/${post.slug}`,
      afmeldUrl: unsubscribeUrl(unsubscribeToken),
      voorkeurenUrl: preferencesUrl(unsubscribeToken),
    },
  })
}

export async function sendBlogTestMail(post: Pick<BlogPost, 'title' | 'summary' | 'slug'>, to: string): Promise<void> {
  const { subject, html } = postMail(post, 'test-token', true, 'Arno')
  const { error } = await resend().emails.send({ from: FROM, to, replyTo: REPLY_TO, subject, html })
  if (error) throw new Error(`Testmail versturen mislukt: ${error.message}`)
}

// Zet voor elke bevestigde, passende abonnee een bezorging in de wachtrij. Passend: kiest
// "alles" (lege topics) of heeft minstens één tag gemeen met de post. De unieke combinatie
// (post, abonnee) maakt dit veilig om opnieuw uit te voeren.
export async function enqueueDeliveries(post: Pick<BlogPost, 'id' | 'tags'>): Promise<number> {
  const db = getBlogDb()
  const PAGE = 1000
  let queued = 0

  for (let from = 0; ; from += PAGE) {
    let q = db.from('arnobot_blog_subscribers').select('id').eq('status', 'confirmed').order('created_at').range(from, from + PAGE - 1)
    q = post.tags.length > 0
      ? q.or(`topics.eq.{},topics.ov.{${post.tags.join(',')}}`)
      : q.filter('topics', 'eq', '{}')
    const { data, error } = await q
    if (error) throw new Error(`Abonnees ophalen mislukt: ${error.message}`)
    const rows = (data ?? []) as { id: string }[]
    if (rows.length === 0) break

    const { error: insErr } = await db
      .from('arnobot_blog_deliveries')
      .upsert(rows.map(r => ({ post_id: post.id, subscriber_id: r.id })), { onConflict: 'post_id,subscriber_id', ignoreDuplicates: true })
    if (insErr) throw new Error(`Wachtrij vullen mislukt: ${insErr.message}`)
    queued += rows.length
    if (rows.length < PAGE) break
  }
  return queued
}

export interface DeliveryRun {
  sent: number
  failed: number
  skipped: number
  budgetLeft: number
}

// Verstuurt wachtende bezorgingen binnen het dagbudget. Veilig om vaak (en gelijktijdig) aan
// te roepen: een bezorging wordt pas als verzonden gemarkeerd na een geslaagde batch.
export async function processBlogDeliveries(): Promise<DeliveryRun> {
  // Slot: publiceren en de cron kunnen tegelijk een run starten. Zonder slot zouden ze dezelfde
  // wachtrijrijen kunnen oppakken en dubbel mailen. Het slot verloopt vanzelf na 2 minuten.
  const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
  const lockKey = 'arnobot:blog-deliveries-lock'
  const locked = await redis.set(lockKey, '1', { nx: true, ex: 120 })
  if (!locked) return { sent: 0, failed: 0, skipped: 0, budgetLeft: 0 }
  try {
    return await runDeliveries()
  } finally {
    await redis.del(lockKey).catch(() => {})
  }
}

async function runDeliveries(): Promise<DeliveryRun> {
  const db = getBlogDb()
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const { count: sentToday } = await db
    .from('arnobot_blog_deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', startOfDay.toISOString())
  const budgetLeft = Math.max(0, dailyBudget() - (sentToday ?? 0))
  const run: DeliveryRun = { sent: 0, failed: 0, skipped: 0, budgetLeft }
  if (budgetLeft === 0) return run

  const { data: queued, error } = await db
    .from('arnobot_blog_deliveries')
    .select('id, post_id, subscriber_id, attempts')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(Math.min(budgetLeft, BATCH_SIZE))
  if (error) throw new Error(`Wachtrij lezen mislukt: ${error.message}`)
  const rows = (queued ?? []) as { id: string; post_id: string; subscriber_id: string; attempts: number }[]
  if (rows.length === 0) return run

  const [{ data: posts }, { data: subs }] = await Promise.all([
    db.from('arnobot_blog_posts').select('id, title, summary, slug, status').in('id', [...new Set(rows.map(r => r.post_id))]),
    db.from('arnobot_blog_subscribers').select('id, email, status, voornaam, unsubscribe_token').in('id', [...new Set(rows.map(r => r.subscriber_id))]),
  ])
  const postById = new Map(((posts ?? []) as { id: string; title: string; summary: string; slug: string; status: string }[]).map(p => [p.id, p]))
  const subById = new Map(((subs ?? []) as { id: string; email: string; status: string; voornaam: string | null; unsubscribe_token: string }[]).map(s => [s.id, s]))

  const messages: { deliveryId: string; msg: Parameters<Resend['batch']['send']>[0][number] }[] = []
  for (const r of rows) {
    const post = postById.get(r.post_id)
    const sub = subById.get(r.subscriber_id)
    // Afgemeld of post teruggetrokken sinds het in de wachtrij kwam: niet versturen.
    if (!post || post.status !== 'published' || !sub || sub.status !== 'confirmed') {
      await db.from('arnobot_blog_deliveries').delete().eq('id', r.id)
      run.skipped++
      continue
    }
    const { subject, html } = postMail(post, sub.unsubscribe_token, false, sub.voornaam)
    messages.push({
      deliveryId: r.id,
      msg: {
        from: FROM,
        to: sub.email,
        replyTo: REPLY_TO,
        subject,
        html,
        headers: {
          'List-Unsubscribe': `<${oneClickUnsubscribeUrl(sub.unsubscribe_token)}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      },
    })
  }
  if (messages.length === 0) return run

  const attemptsById = new Map(rows.map(r => [r.id, r.attempts]))
  // Idempotency-key op basis van de bezorgingen: een herhaalde poging met dezelfde set mailt
  // niet opnieuw, ook niet als het bijwerken van de database hieronder halverwege mislukt.
  const idempotencyKey = 'blog-' + createHash('sha256').update(messages.map(m => m.deliveryId).join(',')).digest('hex').slice(0, 40)
  const { data: result, error: sendErr } = await resend().batch.send(messages.map(m => m.msg), { idempotencyKey })

  if (sendErr || !result) {
    console.error('[blogMail] batch mislukt:', sendErr?.message)
    for (const m of messages) {
      const attempts = (attemptsById.get(m.deliveryId) ?? 0) + 1
      await db
        .from('arnobot_blog_deliveries')
        .update({ attempts, status: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued' })
        .eq('id', m.deliveryId)
      if (attempts >= MAX_ATTEMPTS) run.failed++
    }
    return run
  }

  const ids = result.data
  const now = new Date().toISOString()
  for (let i = 0; i < messages.length; i++) {
    await db
      .from('arnobot_blog_deliveries')
      .update({ status: 'sent', sent_at: now, resend_id: ids[i]?.id ?? null })
      .eq('id', messages[i].deliveryId)
    run.sent++
  }
  run.budgetLeft = Math.max(0, budgetLeft - run.sent)
  return run
}

// Eénmalig per post: wachtrij vullen en markeren dat de abonnees zijn ingepland. Daarna
// verstuurt processBlogDeliveries() het binnen het dagbudget.
export async function notifySubscribersOfPost(post: Pick<BlogPost, 'id' | 'tags'>): Promise<number> {
  const db = getBlogDb()
  // Eerst claimen, dan pas vullen: twee gelijktijdige publicaties kunnen zo niet dubbel inplannen.
  const { data: claimed } = await db
    .from('arnobot_blog_posts')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', post.id)
    .is('notified_at', null)
    .select('id')
    .maybeSingle()
  if (!claimed) return 0
  return enqueueDeliveries(post)
}
