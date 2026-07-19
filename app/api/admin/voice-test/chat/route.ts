import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { buildVoiceSystemPrompt } from '@/lib/systemPrompt'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  return token === process.env.ARNOBOT_ADMIN_KEY
}

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 500

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { text } = await req.json().catch(() => ({}))
  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'Geen tekst' }, { status: 400 })
  }
  const question = text.slice(0, 2000)

  const system = buildVoiceSystemPrompt()
  const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user', content: question }]

  try {
    const res = await anthropic.messages.create({ model: MODEL, max_tokens: MAX_TOKENS, system, messages })
    let answer = getText(res.content)

    if (!answer) {
      console.error('[voice-test/chat] leeg antwoord, retry')
      const retryRes = await anthropic.messages.create({ model: MODEL, max_tokens: MAX_TOKENS, system, messages })
      answer = getText(retryRes.content)
      if (!answer) {
        console.error('[voice-test/chat] leeg antwoord na retry')
        answer = 'Sorry, kun je dat anders verwoorden? Ik kreeg geen goed antwoord terug.'
      }
    }

    // Vangnet vóór het antwoord naar TTS gaat, zelfde markdown-strip als SparClient.speak().
    const spoken = answer
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

    return NextResponse.json({ answer: spoken })
  } catch (err) {
    console.error('[voice-test/chat] error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Verzoek mislukt' }, { status: 500 })
  }
}
