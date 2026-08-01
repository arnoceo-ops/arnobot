import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
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

// Ruwe schatting: ~100 gesproken antwoorden x ~500 tekens, de helft van de nog niet formeel
// vastgestelde betaalde-cap-schatting uit VOICE_PLAN.md fase 2 ("ruim 200/mnd"). Makkelijk
// aan te passen, geen harde onderzochte waarde. Betaalde Voice-abonnees (plan premium/team)
// hebben bewust nog geen plafond-enforcement, dat is het bredere, nog niet gebouwde fase-2-werk.
const TRIAL_VOICE_CHAR_CAP = 50_000

export type VoiceAccessReason = 'paid' | 'trial' | 'trial_expired' | 'trial_cap_reached' | 'none'

/**
 * Bepaalt of een gebruiker nu voice-toegang heeft: premium/team-abonnees altijd, anders
 * gratis tijdens de eerste 30 dagen na trial_start (dezelfde canonieke berekening als
 * proxy.ts:244-246 en cron/trial-emails/route.ts) tot aan TRIAL_VOICE_CHAR_CAP verbruik.
 */
export async function hasVoiceAccess(
  supabase: SupabaseClient,
  userId: string,
  approvedUser: { plan: 'basis' | 'premium' | 'team'; trial_start: string | null }
): Promise<{ access: boolean; reason: VoiceAccessReason }> {
  if (approvedUser.plan !== 'basis') return { access: true, reason: 'paid' }
  if (!approvedUser.trial_start) return { access: false, reason: 'none' }

  const trialEnd = new Date(new Date(approvedUser.trial_start).getTime() + 30 * 24 * 60 * 60 * 1000)
  if (new Date() >= trialEnd) return { access: false, reason: 'trial_expired' }

  const { data } = await supabase
    .from('arnobot_elevenlabs_usage')
    .select('char_count')
    .eq('user_id', userId)
    .gte('created_at', approvedUser.trial_start)
  const used = ((data ?? []) as { char_count: number }[]).reduce((sum, r) => sum + r.char_count, 0)
  if (used >= TRIAL_VOICE_CHAR_CAP) return { access: false, reason: 'trial_cap_reached' }

  return { access: true, reason: 'trial' }
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
