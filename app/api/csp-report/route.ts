import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const report = body['csp-report'] ?? body

    await supabase.from('arnobot_csp_violations').insert({
      document_uri: report['document-uri'] ?? null,
      violated_directive: report['violated-directive'] ?? null,
      blocked_uri: report['blocked-uri'] ?? null,
      user_agent: req.headers.get('user-agent') ?? null,
    })
  } catch {
    // Nooit een error teruggeven — browser verwacht 204
  }

  return new NextResponse(null, { status: 204 })
}
