import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { buildVoiceSystemPrompt } from '@/lib/systemPrompt'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const VOICE_MODEL = 'claude-sonnet-4-6'
const VOICE_MAX_TOKENS = 500
const ELEVENLABS_MODEL_ID = 'eleven_flash_v2_5'

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
