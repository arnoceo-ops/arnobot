export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { vraag, profiel } = await req.json()
    if (!vraag?.trim()) return NextResponse.json({ verfijnd: vraag })

    const profielHint = profiel ? `
Profiel van de gebruiker:
- Rol: ${profiel.rol || '—'}
- Markt: ${Array.isArray(profiel.markt) ? profiel.markt.join(', ') : profiel.markt || '—'}
- Wat hij/zij verkoopt: ${profiel.wat_verkoop_je || '—'}
- Ideale klant: ${profiel.ideale_klant || '—'}
- Grootste uitdaging: ${profiel.uitdaging || '—'}` : ''

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      system: `Je helpt mensen een scherpere vraag formuleren voor een gesprek met Arno Diepeveen, salesstrateeg.${profielHint}

Beoordeel eerst of de input een herkenbare vraag of onderwerp bevat. Als de input onzin, wartaal, willekeurige tekens of onbegrijpelijk is: reageer dan uitsluitend met het woord: ONBEGRIJPELIJK

Als de input wel een herkenbare vraag of context bevat: maak hem concreter en verwijder vaagheid, maar behoud de kern en context die de gebruiker heeft gegeven. Gebruik het profiel om de vraag scherper te maken op hun specifieke situatie. Als de vraag al goed is, voeg dan alleen toe wat ontbreekt. Herschrijf niet voor het herschrijven. Geef alleen de verbeterde vraag. Geen uitleg, geen inleiding, geen aanhalingstekens. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken).`,
      messages: [{ role: 'user', content: vraag }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : vraag
    if (text === 'ONBEGRIJPELIJK') return NextResponse.json({ onbegrijpelijk: true })
    return NextResponse.json({ verfijnd: text })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
