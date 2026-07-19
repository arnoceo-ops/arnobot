'use client'

import { useRef, useState } from 'react'

type Turn = { question: string; answer: string }
type Status = 'idle' | 'thinking' | 'speaking' | 'error'

export default function VoiceTestClient() {
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // "Unlockt" het audio-element binnen de user-activation-window van de huidige klik,
  // zodat de latere, echte .play()-aanroep (na de awaited /chat-call) nog steeds als
  // een gebruikersgeïnitieerd afspelen telt op strikte mobiele browsers/webviews.
  function primeAudioElement(): HTMLAudioElement {
    const audio = audioRef.current ?? new Audio()
    audio.muted = true
    audio.play().catch(() => {})
    audio.pause()
    audio.muted = false
    audioRef.current = audio
    return audio
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const question = input.trim()
    if (!question || status === 'thinking' || status === 'speaking') return

    const audio = primeAudioElement()
    setInput('')
    setStatus('thinking')

    try {
      const chatRes = await fetch('/api/admin/voice-test/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: question }),
      })
      if (!chatRes.ok) throw new Error('chat_failed')
      const data = await chatRes.json()
      const answer: string = data.answer || ''
      setTurns(prev => [...prev, { question, answer }])

      setStatus('speaking')
      audio.src = `/api/admin/voice-test/tts?text=${encodeURIComponent(answer)}`
      audio.onended = () => setStatus('idle')
      audio.onerror = () => setStatus('error')
      await audio.play()
    } catch (err) {
      console.error('[voice-test] submit error:', err)
      setStatus('error')
    }
  }

  function playAnswer(answer: string) {
    const audio = audioRef.current ?? new Audio()
    audioRef.current = audio
    audio.src = `/api/admin/voice-test/tts?text=${encodeURIComponent(answer)}`
    audio.onended = () => setStatus('idle')
    audio.onerror = () => setStatus('error')
    setStatus('speaking')
    audio.play().catch(() => setStatus('error'))
  }

  async function startRecording(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (recording || transcribing || status === 'thinking' || status === 'speaking') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setRecording(false)
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (blob.size < 1000) return
        setTranscribing(true)
        try {
          const form = new FormData()
          form.append('audio', blob, 'recording.webm')
          const res = await fetch('/api/transcribe', { method: 'POST', body: form })
          const data = await res.json()
          if (data.transcript) setInput(prev => prev ? `${prev} ${data.transcript}` : data.transcript)
        } catch (err) {
          console.error('[voice-test] transcribe mislukt:', err)
        } finally {
          setTranscribing(false)
        }
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (err) {
      console.error('[voice-test] getUserMedia mislukt:', err)
    }
  }

  function stopRecording(e?: React.MouseEvent | React.TouchEvent) {
    e?.preventDefault()
    if (!recording) return
    mediaRecorderRef.current?.stop()
  }

  const busy = status === 'thinking' || status === 'speaking'

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 40px' }}>
      <p style={{ color: '#f59e0b', fontSize: '12px', letterSpacing: '4px', marginBottom: '8px' }}>ARNOBOT VOICE</p>
      <h1 style={{ fontSize: '48px', fontWeight: 700, margin: '0 0 12px 0', letterSpacing: '-1px', color: '#f1f5f9' }}>Testpagina</h1>
      <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '32px' }}>
        Alleen zichtbaar voor admin. Elke aanroep is los, geen gesprekshistorie. ElevenLabs Flash v2.5, streaming.
      </p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Typ een testvraag, of gebruik de microfoon..."
          rows={3}
          disabled={busy}
          style={{
            background: '#1f2937', border: '1.5px solid #374151', color: '#f1f5f9',
            padding: '12px 16px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            type="button"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={() => { if (recording) stopRecording() }}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={busy || transcribing}
            title={transcribing ? 'Transcriberen...' : 'Houd ingedrukt om te spreken'}
            style={{
              background: recording ? '#f59e0b' : '#1f2937', border: '1.5px solid #374151',
              color: recording ? '#111827' : '#f1f5f9', padding: '10px 16px', fontSize: '14px', cursor: 'pointer',
            }}
          >
            {transcribing ? '⏳' : '🎤'}
          </button>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            style={{
              background: '#f59e0b', color: '#111827', border: 'none', padding: '10px 24px',
              fontWeight: 700, fontSize: '12px', letterSpacing: '1px', cursor: busy ? 'default' : 'pointer',
              opacity: busy || !input.trim() ? 0.6 : 1,
            }}
          >
            VERSTUUR
          </button>
          <span style={{ fontSize: '12px', color: '#6b7280', letterSpacing: '1px' }}>
            {status === 'thinking' && 'DENKT NA...'}
            {status === 'speaking' && 'SPREEKT...'}
            {status === 'error' && 'ER GING IETS MIS'}
          </span>
        </div>
      </form>

      {turns.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Nog geen testvragen gesteld.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {[...turns].reverse().map((t, i) => (
            <div key={turns.length - i} style={{ borderTop: '2px solid #f59e0b', paddingTop: 16 }}>
              <p style={{ fontWeight: 700, fontSize: '14px', color: '#f1f5f9', marginBottom: 8 }}>{t.question}</p>
              <p style={{ fontSize: '14px', lineHeight: 1.8, color: '#9ca3af', marginBottom: 8 }}>{t.answer}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: 8 }}>{t.answer.length} tekens</p>
              <button
                type="button"
                onClick={() => playAnswer(t.answer)}
                disabled={busy}
                style={{
                  background: 'none', border: '1px solid #374151', color: '#9ca3af',
                  padding: '6px 16px', fontSize: '12px', letterSpacing: '1px', cursor: 'pointer',
                }}
              >
                ▶ AFSPELEN
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
