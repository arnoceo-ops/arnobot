import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const audio = formData.get('audio') as File | null
  if (!audio) return NextResponse.json({ error: 'No audio' }, { status: 400 })

  const whisperForm = new FormData()
  whisperForm.append('file', audio, 'recording.webm')
  whisperForm.append('model', 'whisper-1')
  whisperForm.append('language', 'nl')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: whisperForm,
  })

  if (!res.ok) {
    console.error('Whisper error:', await res.text())
    return NextResponse.json({ error: 'Transcriptie mislukt' }, { status: 502 })
  }

  const data = await res.json()
  return NextResponse.json({ transcript: data.text ?? '' })
}
