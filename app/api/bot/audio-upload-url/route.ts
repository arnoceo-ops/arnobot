import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { AUDIO_UPLOAD_BUCKET, AUDIO_MEDIA_TYPES } from '@/lib/assemblyai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/wav': 'wav', 'audio/x-wav': 'wav',
  'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/webm': 'webm',
}

// Geeft een kortstondige signed upload URL terug zodat de browser het audiobestand
// rechtstreeks naar Supabase Storage stuurt, buiten deze Vercel-functie om (die heeft een
// harde 4,5MB-limiet op de request body, ruim onder wat een gespreksopname weegt).
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Zelfde gate als de transcriptiestap in app/api/chat/route.ts: Basic mag hier al niet
  // eens een upload-URL krijgen, dan hoeft de daadwerkelijke (betaalde) transcriptie-check
  // straks geen verspilde storage-upload meer af te handelen.
  const { data: planRow } = await supabase
    .from('approved_users')
    .select('plan')
    .eq('user_id', userId)
    .single()
  if ((planRow?.plan ?? 'basis') === 'basis') {
    return NextResponse.json({ error: 'audio_alleen_betaald' }, { status: 403 })
  }

  const { mediaType } = await req.json().catch(() => ({}))
  if (typeof mediaType !== 'string' || !AUDIO_MEDIA_TYPES.has(mediaType)) {
    return NextResponse.json({ error: 'bestandstype_niet_ondersteund' }, { status: 400 })
  }

  const path = `${userId}/${randomUUID()}.${EXTENSIONS[mediaType]}`
  const { data, error } = await supabase.storage
    .from(AUDIO_UPLOAD_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('[audio-upload-url] kon geen signed upload URL maken:', error?.message)
    return NextResponse.json({ error: 'audio_transcriptie_mislukt' }, { status: 500 })
  }

  return NextResponse.json({ uploadUrl: data.signedUrl, path })
}
