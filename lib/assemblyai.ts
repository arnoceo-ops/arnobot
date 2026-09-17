import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const AUDIO_UPLOAD_BUCKET = 'chat-audio-uploads'

export const AUDIO_MEDIA_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/webm',
])

const ASSEMBLYAI_BASE = 'https://api.assemblyai.com/v2'
const POLL_INTERVAL_MS = 3000
const MAX_POLL_MS = 240_000 // ruim binnen de maxDuration=300 van app/api/chat/route.ts

type TranscriptResult = { text: string | null; error: string | null }

// Bewaart nooit audio of transcript: de storage-upload wordt na deze aanroep altijd
// verwijderd (succes én fout), zie de finally hieronder. Alleen het teruggegeven
// transcript-tekstblok stroomt door naar de chatprompt, dat blijft alleen bewaard voor
// zover de normale chatgeschiedenis dat al doet voor elk ander antwoord.
export async function transcribeAudioAttachment(
  userId: string,
  storagePath: string
): Promise<TranscriptResult> {
  // storagePath komt uit de request body van de client, dus zonder deze check zou een
  // gebruiker het pad van een ander kunnen opgeven en diens opname laten transcriberen.
  if (!storagePath.startsWith(`${userId}/`)) {
    return { text: null, error: 'audio_niet_gevonden' }
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) {
    console.error('[assemblyai] ASSEMBLYAI_API_KEY ontbreekt')
    return { text: null, error: 'audio_transcriptie_mislukt' }
  }

  const { data: signedUrlData, error: signError } = await supabase.storage
    .from(AUDIO_UPLOAD_BUCKET)
    .createSignedUrl(storagePath, 300)
  if (signError || !signedUrlData?.signedUrl) {
    console.error('[assemblyai] kon geen signed URL maken:', signError?.message)
    return { text: null, error: 'audio_niet_gevonden' }
  }

  let transcriptId: string | null = null
  try {
    const submitRes = await fetch(`${ASSEMBLYAI_BASE}/transcript`, {
      method: 'POST',
      headers: { authorization: apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        audio_url: signedUrlData.signedUrl,
        speaker_labels: true,
        language_codes: ['nl'],
        speech_models: ['universal-3-5-pro'],
      }),
    })
    if (!submitRes.ok) {
      console.error('[assemblyai] transcript-aanvraag mislukt:', await submitRes.text())
      return { text: null, error: 'audio_transcriptie_mislukt' }
    }
    const submitData = await submitRes.json()
    transcriptId = submitData.id
    if (!transcriptId) return { text: null, error: 'audio_transcriptie_mislukt' }

    const startedAt = Date.now()
    while (Date.now() - startedAt < MAX_POLL_MS) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      const pollRes = await fetch(`${ASSEMBLYAI_BASE}/transcript/${transcriptId}`, {
        headers: { authorization: apiKey },
      })
      if (!pollRes.ok) continue
      const pollData = await pollRes.json()
      if (pollData.status === 'completed') {
        const utterances = (pollData.utterances ?? []) as { speaker: string; text: string }[]
        const text = utterances.length > 0
          ? utterances.map(u => `SPREKER ${u.speaker}: ${u.text}`).join('\n')
          : (pollData.text ?? null)
        return { text, error: text ? null : 'audio_transcriptie_mislukt' }
      }
      if (pollData.status === 'error') {
        console.error('[assemblyai] transcriptie-fout:', pollData.error)
        return { text: null, error: 'audio_transcriptie_mislukt' }
      }
    }
    console.error('[assemblyai] transcriptie duurde te lang, sessie:', transcriptId)
    return { text: null, error: 'audio_transcriptie_mislukt' }
  } catch (err) {
    console.error('[assemblyai] onverwachte fout:', err)
    return { text: null, error: 'audio_transcriptie_mislukt' }
  } finally {
    // Opruimen ongeacht uitkomst: niets bewaren buiten deze ene aanroep (besloten bij het
    // ontwerp van deze feature). AssemblyAI en Supabase Storage zijn twee losse plekken
    // waar de audio anders zou kunnen blijven staan.
    await supabase.storage.from(AUDIO_UPLOAD_BUCKET).remove([storagePath]).catch(() => {})
    if (transcriptId) {
      await fetch(`${ASSEMBLYAI_BASE}/transcript/${transcriptId}`, {
        method: 'DELETE',
        headers: { authorization: apiKey },
      }).catch(() => {})
    }
  }
}
