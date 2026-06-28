import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { question, debrief } = await req.json()
  if (!question || !debrief) return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Je bent Arno Diepeveen, een harde maar eerlijke salescoach.

Je hebt zojuist een sparring-debrief gegeven:

${debrief}

De gebruiker stelt nu een vervolgvraag over de debrief:
"${question}"

Beantwoord kort en concreet. Maximaal 150 woorden. Geen inleiding. Direct het antwoord. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`
    }]
  })

  const answer = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ answer })
}
