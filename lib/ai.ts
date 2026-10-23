import type { Message } from '@anthropic-ai/sdk/resources'
import { stripEmphasisAccents } from '@/lib/accenten'

// Vangnet: het taalmodel volgt de "geen streepje als leesteken"-instructie in de
// systeemprompt niet altijd, ook als die er letterlijk in staat (live getest, 2026-07-11).
// [ \t] in plaats van \s: een regeleinde mag nooit worden opgegeten, anders smelten twee
// alinea's/regels samen (brak eerder de AANDACHTSPUNT-parsing in team/1on1/route.ts).
// Em dash/en dash zijn nooit legitiem onderdeel van een samengesteld woord, dus die worden
// altijd vervangen, ook zonder spaties eromheen ("goed—toch knap"). Een los koppelteken
// telt alleen als leesteken met spaties aan beide kanten, anders is het een samengesteld
// woord zoals "MT-lid".
export function stripDashPunctuation(text: string): string {
  return text
    .replace(/[ \t]*[-–—][ \t]*(?=\n)/g, '')
    .replace(/^[ \t]*[-–—][ \t]*/gm, '')
    .replace(/[ \t]*[–—][ \t]*/g, ', ')
    .replace(/[ \t]+-[ \t]+/g, ', ')
}

export function getText(content: Message['content'], fallback = ''): string {
  const block = content.find(b => b.type === 'text')
  return block?.type === 'text' ? stripEmphasisAccents(stripDashPunctuation(block.text)) : fallback
}

// Sanitizer voor streaming tekst: dashPunctuation kan pas correct beoordeeld worden zodra
// bekend is wat erna komt (bijv. of een spatie gevolgd wordt door een newline of niet). Een
// vast aantal tekens "buffer" achterhouden is NIET voldoende (live geverifieerd): de tekst
// vlak vóór een streepje mag pas als definitief worden doorgestuurd zodra vaststaat dat er
// geen streepje meer volgt, anders wordt met terugwerkende kracht een al verstuurde spatie
// ineens onderdeel van een streepjespatroon en klopt de uitvoer niet meer.
export class StreamingDashSanitizer {
  private raw = ''
  private sentLength = 0

  private static readonly RESOLVE_MARGIN = 5

  private safeCutoff(): number {
    let cutoff = this.raw.length
    // Een onaf woord aan het eind blijft in de buffer: de accentcontrole beoordeelt hele woorden.
    while (cutoff > 0 && /\p{L}/u.test(this.raw[cutoff - 1])) cutoff--
    while (cutoff > 0) {
      const last = this.raw[cutoff - 1]
      if (last === ' ' || last === '\t') { cutoff--; continue }
      const windowStart = Math.max(0, cutoff - StreamingDashSanitizer.RESOLVE_MARGIN)
      if (/[-–—]/.test(this.raw.slice(windowStart, cutoff))) { cutoff--; continue }
      break
    }
    return cutoff
  }

  // Voegt een nieuw tekstfragment toe en geeft het stukje terug dat nu veilig verstuurd kan
  // worden (kan leeg zijn als er nog niet genoeg context is om een streepje te beoordelen).
  push(chunk: string): string {
    this.raw += chunk
    const sanitizedStable = stripEmphasisAccents(stripDashPunctuation(this.raw.slice(0, this.safeCutoff())))
    if (sanitizedStable.length <= this.sentLength) return ''
    const toSend = sanitizedStable.slice(this.sentLength)
    this.sentLength = sanitizedStable.length
    return toSend
  }

  // Rondt af: verwerkt alles wat nog in de buffer zit (aan te roepen na de laatste chunk).
  flush(): string {
    const sanitizedFinal = stripEmphasisAccents(stripDashPunctuation(this.raw))
    const toSend = sanitizedFinal.slice(this.sentLength)
    this.sentLength = sanitizedFinal.length
    return toSend
  }
}
