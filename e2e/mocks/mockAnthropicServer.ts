import http from 'http'
import type { Server } from 'http'

// Minimale lokale server die Anthropic's /v1/messages nabootst (zowel streaming als
// niet-streaming), voor niveau-3-tests (echte backend/middleware/RAG-pipeline, nep-LLM).
// De server retourneert altijd hetzelfde voorspelbare antwoord, ongeacht de binnenkomende
// prompt: dit test de eigen keten (auth, rate limiting, RAG-opzoeking, response-parsing),
// niet de kwaliteit van een AI-antwoord.

const MOCK_ANSWER = 'Dit is een voorspelbaar mock-antwoord van de lokale Anthropic-mock-server.'

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function startMockAnthropicServer(port: number): Promise<Server> {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      if (req.method !== 'POST' || !req.url?.startsWith('/v1/messages')) {
        res.writeHead(404).end()
        return
      }
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        let stream = false
        try { stream = JSON.parse(body).stream === true } catch { /* ignore */ }

        if (!stream) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            id: 'msg_mock',
            type: 'message',
            role: 'assistant',
            model: 'claude-mock',
            content: [{ type: 'text', text: MOCK_ANSWER }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 10 },
          }))
          return
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })
        res.write(sseEvent('message_start', {
          type: 'message_start',
          message: { id: 'msg_mock', type: 'message', role: 'assistant', model: 'claude-mock', content: [], usage: { input_tokens: 10, output_tokens: 0 } },
        }))
        res.write(sseEvent('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }))
        res.write(sseEvent('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: MOCK_ANSWER } }))
        res.write(sseEvent('content_block_stop', { type: 'content_block_stop', index: 0 }))
        res.write(sseEvent('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10 } }))
        res.write(sseEvent('message_stop', { type: 'message_stop' }))
        res.end()
      })
    })
    server.listen(port, () => resolve(server))
  })
}
