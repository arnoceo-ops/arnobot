// Korte reden per blogsuggestie onder een afgesloten gesprek: waarom past dit blog bij wat de gebruiker bespraken.
// Een kleine aanroep na de synthese; faalt hij of duurt hij te lang, dan blijven de blogs gewoon zonder reden staan.
import type Anthropic from '@anthropic-ai/sdk'
import * as Sentry from '@sentry/nextjs'
import { getText } from '@/lib/ai'
import { RULE_NO_DASH } from '@/lib/systemPrompt'
import { BRONDATA_REGEL, gesprekBlok } from '@/lib/sessieSamenvatting'

const MAX_TEKENS_REDEN = 140
const TIJDSLIMIET_MS = 8000

/** Haalt de redenen uit het antwoord van het model: een JSON-lijst met evenveel tekstregels als blogs, anders niets. */
export function leesRedenen(tekst: string, aantal: number): string[] {
  const m = tekst.match(/\[[\s\S]*\]/)
  if (!m) return []
  try {
    const lijst: unknown = JSON.parse(m[0])
    if (!Array.isArray(lijst) || lijst.length !== aantal) return []
    return lijst.map(x => (typeof x === 'string' ? x.replace(/[—–]/g, ',').replace(/\s+/g, ' ').trim().slice(0, MAX_TEKENS_REDEN) : ''))
  } catch {
    return []
  }
}

export async function schrijfBlogRedenen(
  anthropic: Anthropic,
  p: { samenvatting: string; titels: string[] },
): Promise<string[]> {
  if (p.titels.length === 0 || !p.samenvatting) return []
  try {
    const aanroep = anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `Je schrijft bij elke blogtitel één korte zin die uitlegt waarom dit blog past bij het gesprek dat de gebruiker net voerde.

Regels:
- Maximaal 15 woorden per zin, in het Nederlands, in de jij-vorm, concreet over het onderwerp van het gesprek.
- Zeg alleen iets dat uit de samenvatting en de titel volgt. Beweer niets over wat er verder in het blog staat.
- Geen verkoopzinnen, geen "interessant" of "handig", geen uitroeptekens.
- ${RULE_NO_DASH}
- Geef ALLEEN een JSON-lijst met precies evenveel tekstregels als er titels zijn, in dezelfde volgorde, bijvoorbeeld ["Zin één.", "Zin twee."]. Geen andere tekst.

${BRONDATA_REGEL}`,
      messages: [{
        role: 'user',
        content: `${gesprekBlok(p.samenvatting.slice(0, 3000))}\n\nBlogtitels:\n${p.titels.map((t, i) => `${i + 1}. ${t}`).join('\n')}`,
      }],
    })
    const res = await Promise.race([
      aanroep,
      new Promise<null>(resolve => setTimeout(() => resolve(null), TIJDSLIMIET_MS)),
    ])
    if (!res) return []
    return leesRedenen(getText(res.content), p.titels.length)
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'blog-redenen' }, level: 'warning' })
    return []
  }
}
