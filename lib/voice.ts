import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getText } from '@/lib/ai'
import { buildVoiceSystemPrompt } from '@/lib/systemPrompt'
import { MANUAL_TEST_USER_ID } from '@/lib/internalTestAccounts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const VOICE_MODEL = 'claude-sonnet-4-6'
const VOICE_MAX_TOKENS = 500
const ELEVENLABS_MODEL_ID = 'eleven_flash_v2_5'

// TIJDELIJK (besloten 2026-08-13, Arno): voice-out staat uit voor iedereen behalve Arno's
// eigen twee accounts, ook voor bestaande betalende Pro/Team-klanten die het al gebruikten
// (bewuste keuze, geen abuis). Reden: nog geen commerciële livegang, Arno wil ElevenLabs
// voice-out eerst alleen zelf verder testen. MANUAL_TEST_USER_ID = zijn handmatige
// testaccount (test@arno.bot); de tweede waarde is zijn echte LinkedIn-account
// (linkedin@royaldutchsales.com, elders in de codebase bekend als BOUWER_EMAIL, hier als
// userId omdat deze routes geen e-mail ophalen). Verwijder VOICE_LAUNCH_RESTRICTED (en de
// check in hasVoiceAccess/isVoiceLaunchAllowed) zodra ArnoBot Voice commercieel live gaat.
const VOICE_LAUNCH_RESTRICTED = true
const VOICE_ALLOWED_USER_IDS: string[] = [
  MANUAL_TEST_USER_ID,
  'user_3Eg9FPzi0PlJEPI3togJKyoyXE6', // linkedin@royaldutchsales.com
]

export function isVoiceLaunchAllowed(userId: string): boolean {
  return !VOICE_LAUNCH_RESTRICTED || VOICE_ALLOWED_USER_IDS.includes(userId)
}

/**
 * Vraagt een kort, gespreksachtig antwoord op via de voice-systeeminstructie.
 * Retry-bij-leeg-antwoord (zelfde patroon als de rest van de codebase), plus een
 * tekstuele fallback als ook de retry leeg blijft. Geeft platte, spreekbare tekst terug.
 */
export async function getVoiceAnswer(question: string): Promise<string> {
  const q = question.slice(0, 2000)
  const system = buildVoiceSystemPrompt()
  const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user', content: q }]

  const res = await anthropic.messages.create({ model: VOICE_MODEL, max_tokens: VOICE_MAX_TOKENS, system, messages })
  let answer = getText(res.content)

  if (!answer) {
    console.error('[voice] leeg antwoord, retry')
    const retryRes = await anthropic.messages.create({ model: VOICE_MODEL, max_tokens: VOICE_MAX_TOKENS, system, messages })
    answer = getText(retryRes.content)
    if (!answer) {
      console.error('[voice] leeg antwoord na retry')
      answer = 'Sorry, kun je dat anders verwoorden? Ik kreeg geen goed antwoord terug.'
    }
  }

  return stripMarkdownForSpeech(answer)
}

/** Verwijdert markdown-opmaak die niet hardop voorgelezen moet worden. */
export function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

export type VoiceAccessReason = 'paid' | 'none'

/**
 * Bepaalt of een gebruiker nu voice-toegang heeft: premium/team (ook tijdens de trial, want
 * die start als premium) wel, Basic nooit.
 */
export async function hasVoiceAccess(
  supabase: SupabaseClient,
  userId: string,
  approvedUser: { plan: 'basis' | 'premium' | 'team'; trial_start: string | null }
): Promise<{ access: boolean; reason: VoiceAccessReason }> {
  if (!isVoiceLaunchAllowed(userId)) return { access: false, reason: 'none' }
  // Besluit 2026-11-06: Basic heeft nooit spraakuitvoer, ook niet binnen de eerste 30 dagen.
  // Een trial-gebruiker start als Pro (plan 'premium') en heeft dus voice; kiest hij Basic,
  // dan stopt voice direct. (De oude Basic-trial-tak met plafond is daarmee vervallen.)
  if (approvedUser.plan === 'basis') return { access: false, reason: 'none' }
  return { access: true, reason: 'paid' }
}

export function isElevenLabsConfigured(): boolean {
  return !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID)
}

/**
 * Streamt ElevenLabs TTS-audio voor de gegeven tekst. Geeft de rauwe fetch-Response terug
 * (niet alleen de body) zodat de aanroepende route zelf op res.ok/status kan reageren.
 */
export function fetchElevenLabsSpeech(text: string): Promise<Response> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID!
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, model_id: ELEVENLABS_MODEL_ID }),
  })
}

export interface ElevenLabsAlignment {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

export interface ElevenLabsSpeechWithAlignment {
  audio_base64: string
  alignment: ElevenLabsAlignment | null
  normalized_alignment: ElevenLabsAlignment | null
}

function appendAlignment(target: ElevenLabsAlignment, source: ElevenLabsAlignment | null | undefined) {
  if (!source?.characters?.length) return
  target.characters.push(...source.characters)
  target.character_start_times_seconds.push(...source.character_start_times_seconds)
  target.character_end_times_seconds.push(...source.character_end_times_seconds)
}

/**
 * Haalt complete audio (base64) plus karakter-niveau alignment op voor de karaoke-achtige
 * meescrollende/highlightende weergave in ArnoBot Voice (SparClient.tsx), via ElevenLabs'
 * STREAMENDE `/stream/with-timestamps`-endpoint, server-side samengevoegd tot dezelfde
 * ene-JSON-vorm als de niet-streamende variant (client blijft ongewijzigd: die wacht toch al
 * op complete audio vóór afspelen, betrouwbaarder op mobiele browsers dan progressief
 * afspelen via MediaSource). Bewust niet de niet-streamende `/with-timestamps` meer: die bleek
 * bij meting ~3,5x trager (2,3s vs 0,65s voor een gemiddeld voice-antwoord) omdat ElevenLabs
 * daar wacht tot de hele clip klaar is vóór er iets terugkomt, i.p.v. audio te sturen zodra
 * die gegenereerd is. Karakter-tijden in de losse chunks zijn cumulatief over de hele stream
 * (leeg getest), dus simpelweg na elkaar plakken in aankomstvolgorde geeft de juiste
 * doorlopende alignment.
 */
export async function fetchElevenLabsSpeechWithAlignment(text: string): Promise<ElevenLabsSpeechWithAlignment> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID!
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, model_id: ELEVENLABS_MODEL_ID }),
  })
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    throw new Error(`ElevenLabs stream/with-timestamps ${res.status}: ${errText}`)
  }

  const audioChunks: Buffer[] = []
  const alignment: ElevenLabsAlignment = { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] }
  const normalizedAlignment: ElevenLabsAlignment = { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const consumeLine = (line: string) => {
    if (!line.trim()) return
    const chunk = JSON.parse(line)
    if (chunk.audio_base64) audioChunks.push(Buffer.from(chunk.audio_base64, 'base64'))
    appendAlignment(alignment, chunk.alignment)
    appendAlignment(normalizedAlignment, chunk.normalized_alignment)
  }
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) consumeLine(line)
  }
  consumeLine(buffer)

  return {
    audio_base64: Buffer.concat(audioChunks).toString('base64'),
    alignment: alignment.characters.length ? alignment : null,
    normalized_alignment: normalizedAlignment.characters.length ? normalizedAlignment : null,
  }
}
