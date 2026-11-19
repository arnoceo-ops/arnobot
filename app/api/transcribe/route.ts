import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { toegangsWeigering } from '@/lib/toegangsPoort'
import { meldGebruikLater, openAiTranscriptieRij } from '@/lib/externGebruik'

// gpt-transcribe (2026-11-01 gewisseld van gpt-4o-transcribe, dat net als whisper-1 per 26-2-2027 uit
// de API gaat, zie CLAUDE.md-modelinventaris). Dit is de gewone transcriptie na het stoppen en de
// terugval voor de live transcriptie (/api/transcribe/live). stream=true geeft de respons als SSE (transcript.text.delta per
// stuk, transcript.text.done aan het eind) i.p.v. één blokkerende JSON-call: bij een langere
// opname zie je de tekst binnenkomen terwijl de rest nog verwerkt wordt, i.p.v. een stilte tot
// het einde. Deze route proxyt de SSE-bytes ongewijzigd door, de client (SparClient.tsx) parset
// de events zelf.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new NextResponse(null, { status: 401 })

  // Geen toegang meer (verlopen proef, geblokkeerd team): geen AI-aanroep. Zie lib/toegangsPoort.ts.
  const geenToegang = await toegangsWeigering(userId)
  if (geenToegang) return geenToegang

  const formData = await req.formData()
  const audio = formData.get('audio') as File | null
  if (!audio) return NextResponse.json({ error: 'No audio' }, { status: 400 })

  // Bestandsnaam met de extensie die bij het echte opnameformaat hoort (webm, ogg of mp4,
  // afhankelijk van de browser). OpenAI leidt het formaat mede af uit de extensie: een mp4-opname
  // van Safari als 'recording.webm' doorsturen mislukte.
  const gevraagdeExt = (audio.name.split('.').pop() ?? '').toLowerCase()
  const ext = ['webm', 'ogg', 'mp4', 'wav'].includes(gevraagdeExt) ? gevraagdeExt : 'webm'
  const transcribeForm = new FormData()
  transcribeForm.append('file', audio, `recording.${ext}`)
  transcribeForm.append('model', 'gpt-transcribe')
  transcribeForm.append('language', 'nl')
  transcribeForm.append('stream', 'true')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: transcribeForm,
  })

  if (!res.ok || !res.body) {
    console.error('[transcribe] OpenAI error:', res.status, await res.text().catch(() => ''))
    return NextResponse.json({ error: 'Transcriptie mislukt' }, { status: 502 })
  }

  // De bytes gaan ongewijzigd naar de client; een tweede kopie van de stroom lezen we mee voor het usage-blok aan het eind (duur of tokens),
  // zodat dicteren per gebruiker gemeten wordt (lib/externGebruik.ts). Een fout in de meting raakt de stroom naar de client niet.
  const [naarClient, naarMeting] = res.body.tee()
  meldGebruikLater((async () => {
    try {
      const tekst = await new Response(naarMeting).text()
      return openAiTranscriptieRij(tekst, userId, 'dicteren')
    } catch {
      return null
    }
  })())

  return new Response(naarClient, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
    },
  })
}
