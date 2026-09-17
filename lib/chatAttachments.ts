import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Alle bijlagen in de hoofdchat (documenten én audio) gaan via deze ene private bucket
// rechtstreeks van browser naar Supabase Storage, buiten onze eigen server-functie om: die
// heeft een harde limiet van 4,5MB op de request body (Vercel-platformlimiet, niet iets wat
// in code op te hogen is). Vóór deze opzet ging elk document nog als base64 in de JSON-body
// mee, wat boven ~3,3MB ruwe bestandsgrootte al die limiet raakte, ook al claimde de UI een
// limiet van 10MB.
export const CHAT_ATTACHMENT_BUCKET = 'chat-audio-uploads'

export const AUDIO_MEDIA_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/webm',
])

export const DOCUMENT_MEDIA_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/csv',
])

const EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/wav': 'wav', 'audio/x-wav': 'wav',
  'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/webm': 'webm',
  'application/pdf': 'pdf',
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt', 'text/csv': 'csv',
}

export async function createAttachmentUploadUrl(userId: string, mediaType: string) {
  const ext = EXTENSIONS[mediaType]
  if (!ext) return { uploadUrl: null, path: null, error: 'bestandstype_niet_ondersteund' as const }

  const path = `${userId}/${randomUUID()}.${ext}`
  const { data, error } = await supabase.storage
    .from(CHAT_ATTACHMENT_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('[chatAttachments] kon geen signed upload URL maken:', error?.message)
    return { uploadUrl: null, path: null, error: 'upload_mislukt' as const }
  }
  return { uploadUrl: data.signedUrl, path, error: null }
}

export async function createAttachmentReadUrl(storagePath: string, expiresInSeconds: number) {
  return supabase.storage.from(CHAT_ATTACHMENT_BUCKET).createSignedUrl(storagePath, expiresInSeconds)
}

export async function deleteAttachment(storagePath: string) {
  await supabase.storage.from(CHAT_ATTACHMENT_BUCKET).remove([storagePath]).catch(() => {})
}

// Voor documenten (i.t.t. audio) heeft de chatroute de bytes zelf nodig, niet alleen een URL
// voor een externe partij: rechtstreeks downloaden via de service-role key, geen signed URL
// nodig. storagePath komt uit de request body van de client, dus zonder de prefix-check zou
// een gebruiker het pad van een ander kunnen opgeven en diens bestand kunnen opvragen.
export async function downloadAndDeleteAttachment(
  userId: string,
  storagePath: string
): Promise<{ buffer: Buffer | null; error: string | null }> {
  if (!storagePath.startsWith(`${userId}/`)) {
    return { buffer: null, error: 'bestand_niet_leesbaar' }
  }
  try {
    const { data, error } = await supabase.storage.from(CHAT_ATTACHMENT_BUCKET).download(storagePath)
    if (error || !data) return { buffer: null, error: 'bestand_niet_leesbaar' }
    return { buffer: Buffer.from(await data.arrayBuffer()), error: null }
  } catch {
    return { buffer: null, error: 'bestand_niet_leesbaar' }
  } finally {
    await deleteAttachment(storagePath)
  }
}
