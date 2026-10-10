import { NextResponse } from 'next/server'
import { isAdminSession } from '@/lib/adminAuth'
import { getBlogDb } from '@/lib/blog'

const PAGE = 1000

// CSV-cel veilig maken: aanhalingstekens verdubbelen, en een cel die met = + - of @ begint
// (formule-injectie in Excel) met een apostrof voorafgaan.
function cell(value: string | null | undefined): string {
  let s = value ?? ''
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

// Admin: alle blogabonnees als CSV, nieuwste aanmelding eerst. Wordt gestreamd in blokken van
// 1000 rijen, zodat het ook bij een heel groot aantal abonnees niet in één keer in het geheugen komt.
export async function GET() {
  if (!(await isAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getBlogDb()
  const encoder = new TextEncoder()
  let offset = 0
  let started = false
  let done = false

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (done) { controller.close(); return }
      let out = ''
      // BOM zodat Excel de accenten goed leest, daarna de kopregel.
      if (!started) {
        started = true
        out += '﻿' + ['aangemeld', 'voornaam', 'email', 'status', 'bevestigd', 'afgemeld'].join(',') + '\r\n'
      }
      const { data, error } = await db
        .from('arnobot_blog_subscribers')
        .select('email, voornaam, status, created_at, confirmed_at, unsubscribed_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + PAGE - 1)
      if (error) { controller.error(new Error('Export mislukt')); return }
      for (const r of (data ?? []) as { email: string; voornaam: string | null; status: string; created_at: string; confirmed_at: string | null; unsubscribed_at: string | null }[]) {
        out += [cell(r.created_at), cell(r.voornaam), cell(r.email), cell(r.status), cell(r.confirmed_at), cell(r.unsubscribed_at)].join(',') + '\r\n'
      }
      controller.enqueue(encoder.encode(out))
      if (!data || data.length < PAGE) done = true
      offset += PAGE
    },
  })

  const datum = new Date().toISOString().slice(0, 10)
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="blog-abonnees-${datum}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
