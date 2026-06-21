import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  const now = new Date()
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString()

  const rows = [
    {
      user_id: 'fake_user_alira_liersen',
      question: 'Hoe ga ik om met een klant die twijfelt aan de prijs?',
      answer: 'Twijfel is informatie. Vraag door op de bron van die twijfel voordat je verdedigt.',
      ip: '0.0.0.0',
      session_id: 'fake_session_alira_1',
      created_at: daysAgo(10),
    },
    {
      user_id: 'fake_user_lisa_bakker',
      question: 'Ik kom niet verder in het gesprek met mijn prospect.',
      answer: 'Stilstand in een gesprek is bijna altijd een signaal dat je te vroeg richting gaat geven.',
      ip: '0.0.0.0',
      session_id: 'fake_session_lisa_1',
      created_at: daysAgo(21),
    },
  ]

  const { error } = await supabase.from('arnobot_rds_logs').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, inserted: rows.length })
}
