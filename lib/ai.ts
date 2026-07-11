import type { Message } from '@anthropic-ai/sdk/resources'

// Vangnet: het taalmodel volgt de "geen streepje als leesteken"-instructie in de
// systeemprompt niet altijd, ook als die er letterlijk in staat (live getest, 2026-07-11).
// Vervangt een los koppelteken/en dash/em dash MET spaties eromheen (dus gebruikt als
// leesteken) door een komma. Koppeltekens in samengestelde woorden zonder omringende
// spaties (bijv. "MT-lid") blijven onaangeroerd.
function stripDashPunctuation(text: string): string {
  return text.replace(/\s+[-–—]\s+/g, ', ')
}

export function getText(content: Message['content'], fallback = ''): string {
  const block = content.find(b => b.type === 'text')
  return block?.type === 'text' ? stripDashPunctuation(block.text) : fallback
}
