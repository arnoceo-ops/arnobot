import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getVoiceAnswer } from '@/lib/voice'
import { adminKeyMatches } from '@/lib/adminAuth'

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  return adminKeyMatches(token)
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { text } = await req.json().catch(() => ({}))
  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'Geen tekst' }, { status: 400 })
  }

  try {
    const answer = await getVoiceAnswer(text)
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('[voice-test/chat] error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Verzoek mislukt' }, { status: 500 })
  }
}
