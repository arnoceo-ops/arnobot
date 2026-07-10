import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function expandQuery(query: string): Promise<string> {
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Herschrijf de volgende zoekvraag naar een rijkere zoekopdracht van maximaal 2 zinnen. Voeg relevante salescontext, synoniemen en concrete begrippen toe zodat de zoekopdracht beter aansluit bij een kennisbank over B2B sales, acquisitie en commercieel leiderschap. Geef alleen de herschreven zoekvraag terug, niets anders.\n\nVraag: ${query}`,
      }],
    })
    const expanded = res.content[0].type === 'text' ? res.content[0].text.trim() : query
    return expanded.length > 20 ? expanded : query
  } catch {
    return query
  }
}

export async function getVoyageEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ input: [text], model: 'voyage-3-large' }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Voyage API error: ${err}`)
  }
  const json = await res.json()
  return json.data[0].embedding
}

// Voor Nederlandse gesprekken en cross-language zoekopdrachten
export async function getMultilingualEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ input: [text], model: 'voyage-multilingual-2' }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Voyage multilingual API error: ${err}`)
  }
  const json = await res.json()
  return json.data[0].embedding
}

async function getEmbedding(text: string): Promise<number[]> {
  return getVoyageEmbedding(text)
}

async function rerankChunks(
  query: string,
  chunks: { content: string; context: string | null; source: string | null; url: string | null }[],
  topN: number
): Promise<{ content: string; context: string | null; source: string | null; url: string | null; relevance_score: number }[]> {
  try {
    const res = await fetch('https://api.voyageai.com/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        documents: chunks.map(c => c.context ? `${c.context}\n\n${c.content}` : c.content),
        model: 'rerank-2',
        top_k: topN,
      }),
    })
    if (!res.ok) throw new Error(`Rerank API error: ${await res.text()}`)
    const data = await res.json()
    const results = data?.results ?? data?.data
    if (!Array.isArray(results)) {
      console.error('[RAG] Rerank onverwacht formaat:', JSON.stringify(data).slice(0, 200))
      return chunks.slice(0, topN).map(c => ({ ...c, relevance_score: 0 }))
    }
    return results.map((r: { index: number; relevance_score: number }) => ({
      ...chunks[r.index],
      relevance_score: r.relevance_score ?? 0,
    }))
  } catch (e) {
    console.error('[RAG] Rerank mislukt, gebruik vector volgorde:', e)
    return chunks.slice(0, topN).map(c => ({ ...c, relevance_score: 0 }))
  }
}

export type RagChunk = { content: string; context: string | null; source: string | null; url: string | null; relevance_score: number }

function diversifyChunks(chunks: RagChunk[], topN: number, perSourceMax = 4): RagChunk[] {
  const sourceCounts: Record<string, number> = {}
  const result: RagChunk[] = []
  for (const chunk of chunks) {
    const src = chunk.source ?? 'unknown'
    if ((sourceCounts[src] ?? 0) >= perSourceMax) continue
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
    result.push(chunk)
    if (result.length >= topN) break
  }
  return result
}

export async function getRelevantChunks(query: string, topN = 20, expand = false): Promise<RagChunk[]> {
  const searchQuery = expand ? await expandQuery(query) : query
  const queryEmbedding = await getEmbedding(searchQuery)

  // Vector: 100 kandidaten voor maximale semantische dekking van het archief.
  // Fulltext: 30 kandidaten op exacte woorden, vangt namen/methodes/cijfers die
  // semantisch niet dicht genoeg bij de vraag liggen om in de vector-top-100 te komen.
  const [{ data, error }, { data: ftData, error: ftError }] = await Promise.all([
    supabase.rpc('match_blog_chunks', {
      query_embedding: queryEmbedding,
      match_count: 100,
    }),
    supabase.rpc('match_blog_chunks_fulltext', {
      query_text: query,
      match_count: 30,
    }),
  ])

  if (error) throw new Error(`Supabase RAG error: ${error.message}`)
  if (ftError) console.error('[RAG] Fulltext-zoekopdracht mislukt, ga verder met alleen vector:', ftError.message)

  const vectorCandidates = (data as { content: string; context: string | null; source: string | null; url: string | null; similarity: number }[])
    .map(row => ({ content: row.content, context: row.context ?? null, source: row.source ?? null, url: row.url ?? null }))

  const fulltextCandidates = (ftData as { content: string; context: string | null; source: string | null; url: string | null; rank: number }[] | null ?? [])
    .map(row => ({ content: row.content, context: row.context ?? null, source: row.source ?? null, url: row.url ?? null }))

  const seen = new Set(vectorCandidates.map(c => c.content))
  const candidates = [...vectorCandidates, ...fulltextCandidates.filter(c => !seen.has(c.content))]

  if (candidates.length === 0) return []

  // Rerank op originele query voor precisie (niet de uitgebreide versie)
  const reranked = await rerankChunks(query, candidates, Math.min(50, candidates.length))
  return diversifyChunks(reranked, topN)
}

export function formatChunksForPrompt(chunks: RagChunk[]): string {
  if (chunks.length === 0) return 'Geen specifieke context gevonden.'
  return chunks
    .map(c => {
      const label = c.source
        ? c.url
          ? `[Bron: ${c.source} | URL: ${c.url}]`
          : `[Bron: ${c.source}]`
        : null
      const contextLine = c.context ? `[Context: ${c.context}]` : null
      const header = [label, contextLine].filter(Boolean).join('\n')
      return header ? `${header}\n${c.content}` : c.content
    })
    .join('\n\n---\n\n')
}
