/**
 * Vertaalt de volledige NL-kennisbank (data/chief_sales_updates.txt) naar het Engels,
 * post voor post, met behoud van Arno's stem. Posten die te Nederlands-cultuurspecifiek
 * zijn om goed te vertalen (lokale verwijzingen, idioom) worden niet stilzwijgend verminkt,
 * maar apart gemarkeerd met een reden zodat Arno ze kan herschrijven i.p.v. vertalen.
 *
 * Dit is een eenmalig, handmatig te draaien controlescript, geen onderdeel van de
 * reguliere pipeline. Het overschrijft geen bestaande kennisbank en embedt niets: het
 * levert alleen een Engels concept + een aandachtspuntenlijst op ter beoordeling.
 *
 * Uitvoeren: node scripts/translate-knowledge-base.mjs
 */

import { readFileSync, writeFileSync, appendFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Laad .env.local handmatig
const envPath = join(__dirname, '..', '.env.local')
const envVars = readFileSync(envPath, 'utf-8')
for (const line of envVars.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '')
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = 'claude-opus-5' // Eenmalige, belangrijke vertaalslag van de kern-IP: kwaliteit boven kosten
const CONCURRENCY = 4
const OUT_DRAFT = join(__dirname, '..', 'data', 'chief_sales_updates_en_draft.txt')
const OUT_NOTES = join(__dirname, '..', 'data', 'translation-review-notes.md')

const DATE_HEADER = /^(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})\s*$/i

// ── Blog parser (zelfde logica als scripts/embed-chunks.mjs, hier gekopieerd zodat dit
// script losstaand blijft draaien) ───────────────────────────────────────────────────
function parseBlogs(text) {
  const lines = text.split('\n')
  const blogs = []
  let currentDate = null
  let currentTitle = null
  let currentLines = []
  let waitingForTitle = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (DATE_HEADER.test(trimmed)) {
      if (currentTitle && currentLines.length > 0) {
        blogs.push({ title: currentTitle, date: currentDate, text: currentLines.join('\n').trim() })
      }
      currentDate = trimmed
      currentTitle = null
      currentLines = []
      waitingForTitle = true
      continue
    }
    if (waitingForTitle && trimmed.length > 0) {
      currentTitle = trimmed.replace(/[\u{1F300}-\u{1FAFF}]/gu, '').trim()
      waitingForTitle = false
      currentLines.push(line)
      continue
    }
    currentLines.push(line)
  }
  if (currentTitle && currentLines.length > 0) {
    blogs.push({ title: currentTitle, date: currentDate, text: currentLines.join('\n').trim() })
  }
  return blogs
}

// ── Vertaling + flag via Claude ──────────────────────────────────────────────────────
const TRANSLATE_TOOL = {
  name: 'submit_translation',
  description: 'Lever de Engelse vertaling en een eventuele waarschuwing voor cultuurspecifieke content.',
  input_schema: {
    type: 'object',
    properties: {
      translated_title: { type: 'string', description: 'De titel, vertaald of ongewijzigd als hij al Engels is.' },
      translation: { type: 'string', description: 'De volledige Engelse vertaling van de post, met behoud van stem en alinea-indeling.' },
      flag_for_rewrite: { type: 'boolean', description: 'True als deze post zo Nederlands-cultuurspecifiek is (lokale idiomen, Nederlandse media/eten/geschiedenis) dat een letterlijke vertaling niet goed international werkt en herschrijven beter is.' },
      flag_reason: { type: 'string', description: 'Korte reden voor de flag, leeg laten als flag_for_rewrite false is.' },
    },
    required: ['translated_title', 'translation', 'flag_for_rewrite'],
  },
}

const SYSTEM_PROMPT = `Je vertaalt Nederlandse sales-blogposts van Arno Diepeveen (arno.blog) naar natuurlijk, idiomatisch Engels voor een internationaal zakelijk publiek.

Behoud zijn stem strikt:
- Direct, ongefilterd, geen corporate taal, geen coachtaal
- Gebruik nooit een streepje als leesteken (em dash of en dash). Herschrijf zinnen met een komma, dubbele punt of nieuwe zin.
- Vermijd "must/should"-taal. Gebruik varianten die vanuit keuze spreken: "you can", "it helps to", "the odds are better if you".
- Engelse sales- en businesstermen die al in de brontekst staan (pipeline, follow-up, mindset, cold calling, closing, framing, etc.) blijven ongewijzigd, dat is al Engels.
- Geen grof taalgebruik toevoegen dat er in het Nederlands niet stond, en geen bestaand grof taalgebruik wegpoetsen: vertaal de toon zoals hij is.
- Zinnen mogen kort en onaf klinken als dat authentieker is. Geen bullet points toevoegen als de brontekst dat niet had.

Als de post zwaar leunt op Nederlandse cultuurspecifieke verwijzingen (lokale uitdrukkingen, Nederlandse media, eten, geschiedenis, woordspelingen die niet vertalen) waardoor een letterlijke vertaling voor een internationaal publiek vlak of onbegrijpelijk wordt: vertaal 'm toch zo goed mogelijk, maar zet flag_for_rewrite op true met een korte reden. Bij twijfel: wel vertalen, wel flaggen, nooit overslaan.`

async function translatePost(post) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [TRANSLATE_TOOL],
    tool_choice: { type: 'tool', name: 'submit_translation' },
    messages: [{
      role: 'user',
      content: `<title>${post.title}</title>\n<post>\n${post.text}\n</post>`,
    }],
  })
  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse) throw new Error('Geen tool_use in response')
  return toolUse.input
}

async function processBatch(posts, startIndex) {
  const results = []
  for (let i = 0; i < posts.length; i += CONCURRENCY) {
    const batch = posts.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map(async (post, j) => {
      const idx = startIndex + i + j
      try {
        const result = await translatePost(post)
        return { post, result, idx }
      } catch (e) {
        console.error(`  [${idx}] MISLUKT: ${post.title} — ${e.message}`)
        return { post, result: null, idx, error: e.message }
      }
    }))
    results.push(...batchResults)
    process.stdout.write(`\r${Math.min(i + CONCURRENCY, posts.length)}/${posts.length} posts verwerkt...`)
  }
  return results
}

async function main() {
  const rawText = readFileSync(join(__dirname, '..', 'data', 'chief_sales_updates.txt'), 'utf-8')
  const posts = parseBlogs(rawText)
  console.log(`${posts.length} posts gevonden in chief_sales_updates.txt`)
  console.log(`Model: ${MODEL}, concurrency: ${CONCURRENCY}\n`)

  writeFileSync(OUT_DRAFT, `Engelse conceptvertaling van chief_sales_updates.txt, gegenereerd via ${MODEL}.\nDit is een concept ter beoordeling, geen definitieve kennisbanktekst.\n\n`)
  writeFileSync(OUT_NOTES, `# Aandachtspunten vertaling kennisbank\n\nPosts die (deels) te Nederlands-cultuurspecifiek zijn voor een letterlijke vertaling. Vertaling is wel geleverd, maar beoordeel of herschrijven beter werkt.\n\n`)

  const results = await processBatch(posts, 0)
  console.log('\n\nWegschrijven...')

  let flaggedCount = 0
  let failedCount = 0
  for (const { post, result, error } of results) {
    if (error) {
      failedCount++
      appendFileSync(OUT_NOTES, `## ${post.title} (${post.date ?? 'onbekende datum'})\nVERTALING MISLUKT: ${error}\n\n`)
      continue
    }
    appendFileSync(OUT_DRAFT, `${result.translated_title}\n${post.date ?? ''}\n\n${result.translation}\n\n---\n\n`)
    if (result.flag_for_rewrite) {
      flaggedCount++
      appendFileSync(OUT_NOTES, `## ${result.translated_title} (${post.date ?? 'onbekende datum'})\n${result.flag_reason || 'Geen reden opgegeven.'}\n\n`)
    }
  }

  console.log(`Klaar. ${posts.length} posts verwerkt, ${flaggedCount} gemarkeerd voor herschrijven, ${failedCount} mislukt.`)
  console.log(`Concept: ${OUT_DRAFT}`)
  console.log(`Aandachtspunten: ${OUT_NOTES}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
