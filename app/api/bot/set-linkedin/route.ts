import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { userId, linkedinUrl } = await req.json()
  if (!userId || !linkedinUrl) return NextResponse.json({ error: 'userId en linkedinUrl verplicht' }, { status: 400 })

  const url = linkedinUrl.trim()
  if (!url.includes('linkedin.com')) return NextResponse.json({ error: 'Geen geldig LinkedIn-adres' }, { status: 400 })

  await supabase.from('approved_users').update({ linkedin: url }).eq('user_id', userId)

  return NextResponse.json({ ok: true, linkedinUrl: url })
}
