import type { Message } from '@anthropic-ai/sdk/resources'

// Vangnet: het taalmodel volgt de "geen streepje als leesteken"-instructie in de
// systeemprompt niet altijd, ook als die er letterlijk in staat (live getest, 2026-07-11).
// [ \t] in plaats van \s: een regeleinde mag nooit worden opgegeten, anders smelten twee
// alinea's/regels samen (brak eerder de AANDACHTSPUNT-parsing in team/1on1/route.ts).
// Em dash/en dash zijn nooit legitiem onderdeel van een samengesteld woord, dus die worden
// altijd vervangen, ook zonder spaties eromheen ("goed—toch knap"). Een los koppelteken
// telt alleen als leesteken met spaties aan beide kanten, anders is het een samengesteld
// woord zoals "MT-lid".
function stripDashPunctuation(text: string): string {
  return text
    .replace(/[ \t]*[-–—][ \t]*(?=\n)/g, '')
    .replace(/^[ \t]*[-–—][ \t]*/gm, '')
    .replace(/[ \t]*[–—][ \t]*/g, ', ')
    .replace(/[ \t]+-[ \t]+/g, ', ')
}

export function getText(content: Message['content'], fallback = ''): string {
  const block = content.find(b => b.type === 'text')
  return block?.type === 'text' ? stripDashPunctuation(block.text) : fallback
}
