// Korte reden per blogsuggestie onder een afgesloten gesprek, en tegelijk de toets of het blog echt aansluit bij wat de gebruiker bespraken.
// Een kleine aanroep na de synthese. Een lege regel van het model betekent "sluit niet aan".
import type Anthropic from '@anthropic-ai/sdk'
import * as Sentry from '@sentry/nextjs'
import { getText } from '@/lib/ai'
import { RULE_NO_DASH } from '@/lib/systemPrompt'
import { BRONDATA_REGEL, gesprekBlok } from '@/lib/sessieSamenvatting'

const MAX_TEKENS_REDEN = 140
const TIJDSLIMIET_MS = 8000

export type BlogKandidaat = { titel: string; uittreksel: string | null; uitGesprek: boolean }

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

/**
 * Bepaalt welke blogs blijven. Een blog dat ArnoBot zelf in het gesprek noemde blijft altijd staan (met de reden als die er is).
 * Een blog uit de zoekopdracht blijft alleen met een reden: geen reden betekent dat het niet aansluit, of dat de aanroep mislukte.
 */
export function beoordeelBlogs<T extends object>(blogs: T[], redenen: string[]): (T & { reden?: string })[] {
  const uit: (T & { reden?: string })[] = []
  blogs.forEach((b, i) => {
    const reden = redenen[i]
    if (reden) uit.push({ ...b, reden })
    else if ((b as { uitGesprek?: boolean }).uitGesprek) uit.push({ ...b })
  })
  return uit
}

export async function schrijfBlogRedenen(
  anthropic: Anthropic,
  p: { samenvatting: string; blogs: BlogKandidaat[] },
): Promise<string[]> {
  if (p.blogs.length === 0 || !p.samenvatting) return []
  try {
    const aanroep = anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Je beoordeelt bij elke blog of hij echt aansluit bij het gesprek dat de gebruiker net voerde, en schrijft dan één korte zin waarom.

Regels:
- Sluit het blog aan op het onderwerp of de vraag uit het gesprek, schrijf dan één zin: maximaal 15 woorden, Nederlands, jij-vorm, concreet over dit gesprek.
- Sluit het blog niet duidelijk aan, of gaat het alleen over een verwant maar ander onderwerp, geef dan een lege tekst (""). Bij twijfel een lege tekst.
- Zeg alleen iets dat uit de samenvatting en het blog (titel en begin) volgt. Beweer niets over wat er verder in het blog staat.
- Geen verkoopzinnen, geen "interessant" of "handig", geen uitroeptekens.
- ${RULE_NO_DASH}
- Geef ALLEEN een JSON-lijst met precies evenveel tekstregels als er blogs zijn, in dezelfde volgorde, bijvoorbeeld ["Zin één.", ""]. Geen andere tekst.

${BRONDATA_REGEL}`,
      messages: [{
        role: 'user',
        content: `${gesprekBlok(p.samenvatting.slice(0, 3000))}\n\nBlogs:\n${p.blogs.map((b, i) => `${i + 1}. Titel: ${b.titel}${b.uittreksel ? `\nBegin: ${b.uittreksel}` : ''}${b.uitGesprek ? '\n(ArnoBot noemde dit blog zelf in het gesprek)' : ''}`).join('\n\n')}`,
      }],
    })
    const res = await Promise.race([
      aanroep,
      new Promise<null>(resolve => setTimeout(() => resolve(null), TIJDSLIMIET_MS)),
    ])
    if (!res) return []
    return leesRedenen(getText(res.content), p.blogs.length)
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'blog-redenen' }, level: 'warning' })
    return []
  }
}
