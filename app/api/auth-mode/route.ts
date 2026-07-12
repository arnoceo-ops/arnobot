import { NextResponse } from 'next/server'
import { getSetting } from '@/lib/settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const enabled = await getSetting('linkedin_fallback_enabled')
  return NextResponse.json({ linkedinFallbackEnabled: enabled })
}
