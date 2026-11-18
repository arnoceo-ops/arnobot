import { NextRequest, NextResponse } from 'next/server'
import { documentenDb, documentenGebruiker, statusVoorFout } from '@/lib/documentenApi'
import { QUOTA_MAX_BYTES, QUOTA_MAX_DOCUMENTEN, isGeldigSessieId } from '@/lib/documentenRegels'
import { bewaardGebruik, lijstBewaardeDocumenten, lijstSessieDocumenten, verwerkNieuweUpload } from '@/lib/documenten'
import { toegangsWeigering } from '@/lib/toegangsPoort'

// GET zonder parameters: de bewaarde documenten van de gebruiker (de tab Docs), met het gebruik en de grenzen.
// GET met ?sessie=<id>: wat ArnoBot in dat gesprek kan lezen (de bijlagen die boven het invoerveld staan).
export async function GET(req: NextRequest) {
  const g = await documentenGebruiker()
  if ('fout' in g) return g.fout
  try {
    const sessie = req.nextUrl.searchParams.get('sessie')
    if (sessie) {
      return NextResponse.json({ documenten: await lijstSessieDocumenten(documentenDb, g.userId, sessie) })
    }

    const [documenten, gebruik] = await Promise.all([
      lijstBewaardeDocumenten(documentenDb, g.userId),
      bewaardGebruik(documentenDb, g.userId),
    ])

    // De titel van het gesprek waarin een document is toegevoegd, alleen van de eigen gesprekken.
    const sessieIds = [...new Set(documenten.map(d => d.session_id).filter(isGeldigSessieId))]
    const titels: Record<string, string> = {}
    if (sessieIds.length > 0) {
      const { data } = await documentenDb
        .from('arnobot_blog_sessions')
        .select('session_id, title')
        .eq('user_id', g.userId)
        .in('session_id', sessieIds)
      for (const s of (data ?? []) as { session_id: string; title: string | null }[]) if (s.title) titels[s.session_id] = s.title
    }

    return NextResponse.json({
      documenten: documenten.map(d => ({ ...d, gesprek: d.session_id ? (titels[d.session_id] ?? null) : null })),
      gebruik,
      grenzen: { maxDocumenten: QUOTA_MAX_DOCUMENTEN, maxBytes: QUOTA_MAX_BYTES },
    })
  } catch (e) {
    console.error('[documenten] lijst mislukt:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ error: 'Laden mislukt' }, { status: 500 })
  }
}

// Een document direct in Docs toevoegen, zonder gesprek. De browser heeft het bestand al via /api/bot/chat-upload-url naar
// de documentenbucket gestuurd en geeft hier het pad door; het wordt als bewaard document vastgelegd.
export async function POST(req: NextRequest) {
  const g = await documentenGebruiker()
  if ('fout' in g) return g.fout
  const geenToegang = await toegangsWeigering(g.userId)
  if (geenToegang) return geenToegang

  const body = await req.json().catch(() => null)
  if (!body || typeof body.storagePath !== 'string' || typeof body.name !== 'string' || typeof body.mediaType !== 'string') {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }
  const r = await verwerkNieuweUpload(documentenDb, {
    userId: g.userId, sessionId: null, naam: body.name, mediaType: body.mediaType, storagePath: body.storagePath, bewaard: true,
  })
  if (r.error) return NextResponse.json({ error: r.error }, { status: statusVoorFout(r.error) })
  return NextResponse.json({ ok: true })
}
