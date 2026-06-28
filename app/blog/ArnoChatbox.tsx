'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'arno'
  content: string
  hint?: string | null
}

const STARTERS = [
  'Waarom haal ik mijn target niet?',
  'Hoe kom ik binnen bij een nieuwe klant?',
  'Wat maakt een topverkoper anders?',
  'Hoe ga ik om met afwijzing?',
  'Wat is het verschil tussen verkopen en opdringen?',
  'Hoe bouw ik een winnend sales team?',
]

function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>
    if ((part.startsWith('_') && part.endsWith('_')) || (part.startsWith('*') && part.endsWith('*')))
      return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

function HintBlock({ hint }: { hint: string }) {
  if (hint === 'last_chance') {
    return (
      <div className="chat-hint">
        Lekker bezig. Je hebt nog één kans om echt tot de kern te komen.
      </div>
    )
  }
  if (hint === 'salescanvas' || hint === 'blocked') {
    return (
      <div className="chat-cta">
        <p>{hint === 'blocked' ? 'Toch proberen, hè? 😂' : 'Als je echt de diepte in wilt, doe dan een free trial.'}</p>
        <a href="https://salescanvas.app" target="_blank" rel="noopener noreferrer" className="chat-cta-btn">
          → Probeer SalesCanvas gratis
        </a>
      </div>
    )
  }
  return null
}

export default function ArnoChatbox() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [history, setHistory] = useState<{role: string, content: string}[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function ask(question: string) {
    if (!question.trim() || loading || blocked) return

    setMessages(prev => [...prev, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history })
      })
      const data = await res.json()

      if (data.blocked) {
        setBlocked(true)
        setMessages(prev => [...prev, { role: 'arno', content: '', hint: 'blocked' }])
        return
      }

      const answer = data.answer || 'Geen antwoord ontvangen.'
      setMessages(prev => [...prev, { role: 'arno', content: answer, hint: data.hint ?? null }])
      setHistory(prev => [
        ...prev,
        { role: 'user', content: question },
        { role: 'assistant', content: answer }
      ])
    } catch {
      setMessages(prev => [...prev, { role: 'arno', content: 'Er ging iets mis. Probeer het opnieuw.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="chat-header">
        <h2 className="chat-title">Vraag het<br /><span>Arno.</span></h2>
        <span className="chat-sub">Antwoorden gebaseerd op 15+ jaar blogs</span>
      </div>

      {messages.length === 0 && (
        <div className="chat-starters">
          {STARTERS.map((s, i) => (
            <button key={i} className="chat-starter" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i}>
              <div className={msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-arno'}>
                {msg.role === 'arno' && msg.content && <strong>Arno:</strong>}
                {msg.role === 'arno' ? renderMarkdown(msg.content) : msg.content}
              </div>
              {msg.hint && <HintBlock hint={msg.hint} />}
            </div>
          ))}
          {loading && <div className="chat-loading">Arno denkt na...</div>}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="chat-input-row">
        <input
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask(input)}
          placeholder={blocked ? 'Kom morgen terug.' : 'Stel Arno een vraag over sales, strategie of mindset...'}
          disabled={loading || blocked}
        />
        <button
          className="chat-send"
          onClick={() => ask(input)}
          disabled={loading || blocked}
        >
          {loading ? '...' : 'VRAAG →'}
        </button>
      </div>
    </div>
  )
}
