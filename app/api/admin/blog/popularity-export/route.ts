import { NextResponse } from 'next/server'
import { isAdminSession } from '@/lib/adminAuth'
import { getBlogDb } from '@/lib/blog'

// CSV-cel veilig maken: aanhalingstekens verdubbelen, en een cel die met = + - of @ begint
// (formule-injectie in Excel) met een apostrof voorafgaan.
function cell(value: string | number | null | undefined): string {
  let s = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

// Admin: populariteit van alle gepubliceerde blogs als CSV, meest geopend (laatste 30 dagen) eerst.
// Dezelfde telling als de lijst in de blogstatistieken (SQL-functie arnobot_blog_post_stats).
export async function GET() {
  if (!(await isAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data, error } = await getBlogDb().rpc('arnobot_blog_post_stats', { p_since: since30 })
  if (error) return NextResponse.json({ error: 'Export mislukt' }, { status: 500 })

  const rows = (data ?? []) as {
    slug: string; title: string; published_at: string | null
    opens_period: number; opens_total: number; cta_period: number; cta_total: number
  }[]

  let csv = '﻿' + ['titel', 'url', 'gepubliceerd', 'geopend_30d', 'geopend_totaal', 'start_gratis_30d', 'start_gratis_totaal'].join(',') + '\r\n'
  for (const r of rows) {
    csv += [cell(r.title), cell(`https://www.arno.bot/blog/${r.slug}`), cell(r.published_at), r.opens_period, r.opens_total, r.cta_period, r.cta_total].join(',') + '\r\n'
  }

  const datum = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="blog-populariteit-${datum}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
