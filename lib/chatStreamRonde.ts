import type Anthropic from '@anthropic-ai/sdk'
import { StreamingDashSanitizer } from '@/lib/ai'

// Tekst vóór een hulpmiddel is werkruis ("laat me de tabel overschrijven", "ik lees hem opnieuw in") en hoort niet in het antwoord.
// Heeft de beurt hulpmiddelen, dan wordt het begin van een ronde vastgehouden tot duidelijk is of de ronde in een toolaanroep eindigt:
// dan wordt die tekst weggegooid. Wordt het een gewoon antwoord (of langer dan een aankondiging kan zijn), dan gaat het alsnog door.
// Zonder hulpmiddelen streamt alles direct, zoals voorheen.
export const HOUD_VAST_TEKENS = 400

// Werkruis aan het BEGIN van een antwoord dat na een hulpmiddel komt ("Goed. De tabel staat goed en de berekening klopt met wat we al hadden.",
// "Laat me de tabel eerst overschrijven."): dat vertelt wat de app onder de motorkap doet en hoort de gebruiker niet te zien. Alleen volledige
// zinnen aan het begin, en alleen zinnen die over het eigen werk met de tabel of bijlage gaan, zodat inhoud nooit wordt geschrapt.
const WERKRUIS_ZIN = [
  /^(goed|oké|oke|ok|prima|helder|duidelijk)[.!]?$/i,
  /^(laat me|laat mij|ik ga (eerst|even)|eerst (de|het|even))\b/i,
  /\b(tabel|bijlage|afbeelding|screenshot|dashboard)\b.*\b(overschr\w+|ingelezen|opnieuw (lezen|inlezen)|goed gelezen|staat goed|klopt|controleer\w*|gecontroleerd)\b/i,
  /\b(overgeschreven|overschrijven|opnieuw ingelezen)\b/i,
]
const MAX_WERKRUIS_ZINNEN = 3
export function haalWerkruisWeg(tekst: string): string {
  let rest = tekst
  for (let i = 0; i < MAX_WERKRUIS_ZINNEN; i++) {
    const m = rest.match(/^\s*([^.!?\n]+[.!?])(?=\s|$)\s*/)
    if (!m || !WERKRUIS_ZIN.some(re => re.test(m[1].trim()))) break
    rest = rest.slice(m[0].length)
  }
  return rest
}

export async function streamRonde(
  stream: AsyncIterable<Anthropic.MessageStreamEvent>,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  houdVast: boolean,
): Promise<{ verborgen: boolean; weggegooid: string }> {
  const sanitizer = new StreamingDashSanitizer()
  let heeftTekst = false
  let vrijgegeven = !houdVast
  let verborgen = false
  let wacht = ''
  let weggegooid = ''
  const stuur = (tekst: string) => {
    if (!tekst || verborgen) return
    if (vrijgegeven) { controller.enqueue(encoder.encode(tekst)); return }
    wacht += tekst
    if (wacht.length > HOUD_VAST_TEKENS) { vrijgegeven = true; geefVrij(wacht); wacht = '' }
  }
  // Het eerste stuk van een ronde met hulpmiddelen gaat eerst door het werkruisfilter (zie haalWerkruisWeg).
  const geefVrij = (tekst: string) => {
    const schoon = haalWerkruisWeg(tekst)
    if (schoon) controller.enqueue(encoder.encode(schoon))
  }
  for await (const event of stream) {
    if (event.type === 'content_block_start' && event.content_block.type === 'tool_use' && !vrijgegeven) {
      verborgen = true
      weggegooid = wacht
      wacht = ''
    }
    // Met een link ophalen tussendoor bestaat een antwoord uit meerdere tekstblokken (voor en na het ophalen):
    // een lege regel ertussen, anders plakt "ik kijk even" aan het antwoord vast.
    if (event.type === 'content_block_start' && event.content_block.type === 'text' && heeftTekst) {
      stuur(sanitizer.flush())
      stuur('\n\n')
    }
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      heeftTekst = true
      stuur(sanitizer.push(event.delta.text))
    }
  }
  stuur(sanitizer.flush())
  if (!vrijgegeven && !verborgen && wacht) geefVrij(wacht)
  return { verborgen, weggegooid }
}
