import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from './ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

type ExtractedEntity = { name: string; type: string }

async function extractEntities(conversationText: string): Promise<ExtractedEntity[]> {
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: 'Extraheer belangrijke, herbruikbare entiteiten uit een salesgesprek: namen van personen, bedrijven, en concrete terugkerende thema\'s die de gebruiker waarschijnlijk vaker zal noemen. Geen algemene sales-termen. Geef een JSON-array van objecten {"name": string, "type": "persoon"|"bedrijf"|"thema"} terug, maximaal 5. Geef alleen de JSON-array terug, niets anders.',
      messages: [{ role: 'user', content: conversationText.slice(0, 8000) }],
    })
    const text = getText(res.content, '[]').trim()
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    const parsed = JSON.parse(start >= 0 && end >= 0 ? text.slice(start, end + 1) : '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((e): e is ExtractedEntity => !!e && typeof e.name === 'string' && e.name.trim().length > 0)
      .map(e => ({ name: e.name.trim(), type: typeof e.type === 'string' ? e.type : 'onbekend' }))
      .slice(0, 5)
  } catch (e) {
    console.error('[memoryEntities] extractie mislukt:', e)
    return []
  }
}

// Enige plek die arnobot_memory_entities beschrijft bij het aanmaken van een sessie. Alle
// aanmaak-paden (session-end/route.ts, en de wees-sessie-reparatie in sessions/route.ts) gaan
// hier doorheen, niet zelf entiteiten extraheren/opslaan: zelfde reden als embedSessionText in
// lib/rag.ts, één plek voorkomt dat losse aanroeppaden elkaar uit de pas laten lopen (zie de
// embedding-model-mix van 2026-08-12 voor wat er misgaat als dat niet gebeurt).
export async function extractAndStoreEntities(userId: string, sessionId: string, conversationText: string): Promise<void> {
  const entities = await extractEntities(conversationText)
  if (entities.length === 0) return

  const names = entities.map(e => e.name)
  const { data: existing } = await supabase
    .from('arnobot_memory_entities')
    .select('id, entity_name, session_ids')
    .eq('user_id', userId)
    .in('entity_name', names)

  const existingByName = new Map((existing ?? []).map(row => [row.entity_name, row]))
  const now = new Date().toISOString()

  for (const entity of entities) {
    const found = existingByName.get(entity.name)
    if (found) {
      if ((found.session_ids as string[]).includes(sessionId)) continue
      const newSessionIds = [...(found.session_ids as string[]), sessionId]
      await supabase.from('arnobot_memory_entities').update({
        session_ids: newSessionIds,
        mention_count: newSessionIds.length,
        last_mentioned_at: now,
      }).eq('id', found.id)
    } else {
      await supabase.from('arnobot_memory_entities').insert({
        user_id: userId,
        entity_name: entity.name,
        entity_type: entity.type,
        session_ids: [sessionId],
        mention_count: 1,
        first_mentioned_at: now,
        last_mentioned_at: now,
      })
    }
  }
}

// Enige plek die arnobot_memory_entities opschoont wanneer een sessie soft-deleted wordt. Alle
// soft-delete-paden (de Basic-retentiegrens in sessions/route.ts, en de handmatige DELETE in
// session/route.ts) gaan hier doorheen. Besloten 2026-08-12: entiteitengeheugen volgt dezelfde
// retentie als sessies zelf, geen onafhankelijk blijvend geheugen, anders zou een
// Basic-gebruiker info onthouden zien die uit losse gesprekken al "verwijderd" is.
export async function pruneEntitiesForDeletedSessions(userId: string, sessionIds: string[]): Promise<void> {
  if (sessionIds.length === 0) return
  const { data: rows } = await supabase
    .from('arnobot_memory_entities')
    .select('id, session_ids')
    .eq('user_id', userId)
    .overlaps('session_ids', sessionIds)
  if (!rows?.length) return

  for (const row of rows) {
    const remaining = (row.session_ids as string[]).filter(id => !sessionIds.includes(id))
    if (remaining.length === 0) {
      await supabase.from('arnobot_memory_entities').delete().eq('id', row.id)
    } else {
      await supabase.from('arnobot_memory_entities').update({
        session_ids: remaining,
        mention_count: remaining.length,
      }).eq('id', row.id)
    }
  }
}

export type RecurringEntity = { entity_name: string; entity_type: string | null; mention_count: number; last_mentioned_at: string }

// Voor injectie in de hoofdchat: entiteiten die (case-insensitive) in de huidige vraag worden
// genoemd en al in minstens één eerdere, nog niet verwijderde sessie voorkwamen. mention_count
// telt alleen afgesloten sessies (het huidige gesprek is nog niet geëxtraheerd), dus >= 1 is
// hier al "dit is niet de eerste keer", niet >= 2.
export async function findRecurringEntitiesInQuestion(userId: string, question: string): Promise<RecurringEntity[]> {
  const { data: entities } = await supabase
    .from('arnobot_memory_entities')
    .select('entity_name, entity_type, mention_count, last_mentioned_at')
    .eq('user_id', userId)
    .gte('mention_count', 1)
  if (!entities?.length) return []

  const lowerQuestion = question.toLowerCase()
  return entities.filter(e => lowerQuestion.includes(e.entity_name.toLowerCase()))
}
