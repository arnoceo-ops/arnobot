import { createHash } from 'crypto'

// Pagina's van leveranciers die wekelijks gecontroleerd worden door cron/leveranciers-wijzigingen.
// De DPA's van Supabase, Clerk, Vercel, Anthropic en OpenAI staan bewust in VisualPing (gratis tier, 5 pagina's).
// OpenAI blokkeert geautomatiseerde aanvragen (cron faalde), VisualPing gebruikt een echte browser.
export type PaginaCategorie = 'dpa' | 'deprecations'

export interface LeverancierPagina {
  url: string
  label: string
  categorie: PaginaCategorie
  pdf?: boolean
}

export const PAGINAS: LeverancierPagina[] = [
  { url: 'https://resend.com/legal/dpa', label: 'Resend DPA', categorie: 'dpa' },
  { url: 'https://elevenlabs.io/dpa', label: 'ElevenLabs DPA', categorie: 'dpa' },
  { url: 'https://posthog.com/dpa', label: 'PostHog DPA', categorie: 'dpa' },
  { url: 'https://sentry.io/legal/dpa/', label: 'Sentry DPA', categorie: 'dpa' },
  { url: 'https://www.mollie.com/legal/data-processing-agreement', label: 'Mollie DPA', categorie: 'dpa' },
  { url: 'https://www.assemblyai.com/legal/data-processing-addendum', label: 'AssemblyAI DPA', categorie: 'dpa' },
  { url: 'https://www.moneybird.nl/privacy/', label: 'Moneybird privacyverklaring', categorie: 'dpa' },
  { url: 'https://www.moneybird.nl/partners/', label: 'Moneybird subverwerkers', categorie: 'dpa' },
  { url: 'https://upstash.com/trust/dpa.pdf', label: 'Upstash DPA (PDF)', categorie: 'dpa', pdf: true },
  { url: 'https://platform.openai.com/docs/deprecations', label: 'OpenAI deprecations', categorie: 'deprecations' },
  { url: 'https://docs.anthropic.com/en/docs/about-claude/model-deprecations', label: 'Anthropic deprecations', categorie: 'deprecations' },
  { url: 'https://docs.voyageai.com/docs/pricing', label: 'Voyage modellen en prijzen', categorie: 'deprecations' },
]

// Een pagina met minder tekst dan dit is vrijwel zeker niet goed opgehaald (laadt met JavaScript,
// blokkeert de aanvraag of toont een foutpagina) en telt als mislukte poging.
export const MIN_TEKENS = 500
export const MAX_OPGESLAGEN_TEKENS = 400_000
export const MELD_FOUT_NA = 3

const ENTITEITEN: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&rsquo;': "'", '&lsquo;': "'", '&ldquo;': '"', '&rdquo;': '"', '&ndash;': '-', '&mdash;': '-',
}

// Haalt de leesbare tekst uit HTML, regel per blok, zonder navigatie, footer, scripts en tellers
// (zoals "114.4K" bij een GitHub- of communityteller) zodat alleen echte tekstwijzigingen overblijven.
export function schoonTekst(html: string): string {
  let t = html
  t = t.replace(/<!--[\s\S]*?-->/g, ' ')
  t = t.replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|button|select)\b[\s\S]*?<\/\1>/gi, ' ')
  t = t.replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|table|section|article|blockquote|pre)>/gi, '\n')
  t = t.replace(/<(br|hr)\s*\/?>/gi, '\n')
  t = t.replace(/<[^>]+>/g, ' ')
  t = t.replace(/&[a-z#0-9]+;/gi, m => ENTITEITEN[m.toLowerCase()] ?? ' ')
  t = t.replace(/\b\d{1,3}(?:[.,]\d)?\s?[KkMm]\b/g, ' ')
  return t
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l.length > 0)
    .join('\n')
}

export function hashTekst(tekst: string): string {
  return createHash('sha256').update(tekst).digest('hex')
}

export interface Verschil {
  toegevoegd: string[]
  verwijderd: string[]
}

// Regelverschil op inhoud: welke regels zijn nieuw, welke verdwenen (volgorde en dubbelen genegeerd).
export function bepaalVerschil(oud: string, nieuw: string): Verschil {
  const oudSet = new Set(oud.split('\n'))
  const nieuwSet = new Set(nieuw.split('\n'))
  return {
    toegevoegd: nieuw.split('\n').filter(l => !oudSet.has(l)),
    verwijderd: oud.split('\n').filter(l => !nieuwSet.has(l)),
  }
}

export function verschilAlsTekst(v: Verschil, maxTekens = 6000): string {
  const stuk = (kop: string, regels: string[]) =>
    regels.length ? `${kop}\n${regels.map(r => `- ${r.slice(0, 600)}`).join('\n')}` : ''
  const tekst = [stuk('NIEUW OF GEWIJZIGD:', v.toegevoegd), stuk('VERDWENEN:', v.verwijderd)].filter(Boolean).join('\n\n')
  return tekst.length > maxTekens ? tekst.slice(0, maxTekens) + '\n[ingekort]' : tekst
}
