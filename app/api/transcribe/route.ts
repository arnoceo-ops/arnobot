import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// gpt-4o-transcribe i.p.v. whisper-1 (deprecated per 26-8-2026, harde shutdown 26-2-2027, zie
// CLAUDE.md-modelinventaris). stream=true geeft de respons als SSE (transcript.text.delta per
// stuk, transcript.text.done aan het eind) i.p.v. één blokkerende JSON-call: bij een langere
// opname zie je de tekst binnenkomen terwijl de rest nog verwerkt wordt, i.p.v. een stilte tot
// het einde. Deze route proxyt de SSE-bytes ongewijzigd door, de client (SparClient.tsx) parset
// de events zelf.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new NextResponse(null, { status: 401 })

  const formData = await req.formData()
  const audio = formData.get('audio') as File | null
  if (!audio) return NextResponse.json({ error: 'No audio' }, { status: 400 })

  const transcribeForm = new FormData()
  transcribeForm.append('file', audio, 'recording.webm')
  transcribeForm.append('model', 'gpt-4o-transcribe')
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

  return new Response(res.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
    },
  })
}
