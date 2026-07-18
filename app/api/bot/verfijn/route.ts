export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { vraag, profiel, context } = await req.json()
    if (!vraag?.trim()) return NextResponse.json({ verfijnd: vraag })
    if (typeof vraag !== 'string' || vraag.length > 2000) {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
    }

    const profielHint = profiel ? `
Profiel van de gebruiker:
- Rol: ${profiel.rol || 'onbekend'}
- Markt: ${Array.isArray(profiel.markt) ? profiel.markt.join(', ') : profiel.markt || 'onbekend'}
- Wat hij/zij verkoopt: ${profiel.wat_verkoop_je || 'onbekend'}
- Ideale klant: ${profiel.ideale_klant || 'onbekend'}
- Grootste uitdaging: ${profiel.uitdaging || 'onbekend'}` : ''

    const contextHint = context ? `\n\nVorig antwoord van ArnoBot in dit gesprek:\n"${context.slice(0, 800)}"` : ''

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      system: `Je helpt mensen een scherpere reactie of vraag formuleren voor een gesprek met Arno Diepeveen, salesstrateeg.${profielHint}${contextHint}

Als er een vorig antwoord van ArnoBot aanwezig is, is de input een vervolg op dat gesprek. Een statement, antwoord of aanvulling is dan net zo geldig als een vraag.

Beoordeel eerst of de input herkenbare inhoud bevat. Als de input onzin, wartaal, willekeurige tekens of volledig onbegrijpelijk is zonder enige context: reageer dan uitsluitend met het woord: ONBEGRIJPELIJK

Als de input wel herkenbare inhoud heeft: maak hem concreter en scherper, maar behoud de kern. Gebruik het profiel en de gesprekscontext om de reactie relevanter te maken. Herschrijf niet voor het herschrijven. Geef alleen de verbeterde versie. Geen uitleg, geen inleiding, geen aanhalingstekens. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken).`,
      messages: [{ role: 'user', content: vraag }]
    })

    const text = getText(response.content, vraag).trim()
    if (text === 'ONBEGRIJPELIJK') return NextResponse.json({ onbegrijpelijk: true })
    return NextResponse.json({ verfijnd: text })
  } catch (err) {
    console.error('Verfijn error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Verwerking mislukt' }, { status: 500 })
  }
}
