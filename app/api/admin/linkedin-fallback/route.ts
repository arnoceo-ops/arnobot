import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { setSetting } from '@/lib/settings'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { enabled } = await req.json()
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  await setSetting('linkedin_fallback_enabled', enabled)
  return NextResponse.json({ ok: true, enabled })
}
