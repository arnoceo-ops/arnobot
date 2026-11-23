import type Anthropic from '@anthropic-ai/sdk'
import { StreamingDashSanitizer } from '@/lib/ai'

// Tekst vóór een hulpmiddel is werkruis ("laat me de tabel overschrijven", "ik lees hem opnieuw in") en hoort niet in het antwoord.
// Heeft de beurt hulpmiddelen, dan wordt het begin van een ronde vastgehouden tot duidelijk is of de ronde in een toolaanroep eindigt:
// dan wordt die tekst weggegooid. Wordt het een gewoon antwoord (of langer dan een aankondiging kan zijn), dan gaat het alsnog door.
// Zonder hulpmiddelen streamt alles direct, zoals voorheen.
export const HOUD_VAST_TEKENS = 400
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
    if (wacht.length > HOUD_VAST_TEKENS) { vrijgegeven = true; controller.enqueue(encoder.encode(wacht)); wacht = '' }
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
  if (!vrijgegeven && !verborgen && wacht) controller.enqueue(encoder.encode(wacht))
  return { verborgen, weggegooid }
}
