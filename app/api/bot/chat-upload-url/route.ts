import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { AUDIO_MEDIA_TYPES, DOCUMENT_MEDIA_TYPES, createAttachmentUploadUrl } from '@/lib/chatAttachments'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Geeft een kortstondige signed upload URL terug zodat de browser een bijlage (document of
// audio) rechtstreeks naar Supabase Storage stuurt, buiten deze Vercel-functie om (die heeft
// een harde 4,5MB-limiet op de request body, ver onder wat zowel een gespreksopname als een
// wat groter document weegt).
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { mediaType } = await req.json().catch(() => ({}))
  if (typeof mediaType !== 'string' || (!AUDIO_MEDIA_TYPES.has(mediaType) && !DOCUMENT_MEDIA_TYPES.has(mediaType))) {
    return NextResponse.json({ error: 'bestandstype_niet_ondersteund' }, { status: 400 })
  }

  // Alleen audio is een betaalde, kostprijs-per-gebruik-functie (AssemblyAI-transcriptie).
  // Documenten blijven voor elk plan beschikbaar, zoals al jaren het geval was.
  if (AUDIO_MEDIA_TYPES.has(mediaType)) {
    const { data: planRow } = await supabase
      .from('approved_users')
      .select('plan')
      .eq('user_id', userId)
      .single()
    if ((planRow?.plan ?? 'basis') === 'basis') {
      return NextResponse.json({ error: 'audio_alleen_betaald' }, { status: 403 })
    }
  }

  const { uploadUrl, path, error } = await createAttachmentUploadUrl(userId, mediaType)
  if (error || !uploadUrl || !path) {
    return NextResponse.json({ error: error ?? 'upload_mislukt' }, { status: 500 })
  }

  return NextResponse.json({ uploadUrl, path })
}
