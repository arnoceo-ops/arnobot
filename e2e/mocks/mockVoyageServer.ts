import http from 'http'
import type { Server } from 'http'

// Minimale lokale server die Voyage's /v1/embeddings en /v1/rerank nabootst, voor
// niveau-3-tests. Retourneert altijd een vaste, geldige vector/ranking, geen echte
// semantische betekenis: test de eigen samenvoeg/dedupe/parse-logica, niet Voyage's kwaliteit.

const FIXED_EMBEDDING = Array.from({ length: 1024 }, (_, i) => Math.sin(i))

export function startMockVoyageServer(port: number): Promise<Server> {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        if (req.url?.startsWith('/v1/embeddings')) {
          let count = 1
          try { count = JSON.parse(body).input?.length ?? 1 } catch { /* ignore */ }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ data: Array.from({ length: count }, () => ({ embedding: FIXED_EMBEDDING })) }))
          return
        }
        if (req.url?.startsWith('/v1/rerank')) {
          let documentCount = 0
          try { documentCount = JSON.parse(body).documents?.length ?? 0 } catch { /* ignore */ }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          // "data", niet "results": zo geeft Voyage's echte rerank-API het nu terug (live
          // geverifieerd via lib/contract.test.ts, 2026-07). lib/rag.ts's rerankChunks() heeft
          // een fallback voor beide, maar de mock moet de actuele werkelijkheid weerspiegelen.
          res.end(JSON.stringify({
            data: Array.from({ length: documentCount }, (_, i) => ({ index: i, relevance_score: 1 - i * 0.01 })),
          }))
          return
        }
        res.writeHead(404).end()
      })
    })
    server.listen(port, () => resolve(server))
  })
}
