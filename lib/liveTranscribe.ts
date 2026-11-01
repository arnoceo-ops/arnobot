// Live transcriptie in de browser met gpt-live-transcribe: de tekst verschijnt terwijl je praat.
//
// Het geluid wordt lokaal opgevangen (AudioWorklet, public/live-opvang.js) en over een WebSocket
// rechtstreeks naar OpenAI gestuurd met een kortlevende sessiecode van de server
// (/api/transcribe/live). Omdat het geluid vanaf de eerste milliseconde lokaal wordt gebufferd,
// gaat er niets verloren terwijl de verbinding nog opstart (bij WebRTC viel de eerste seconde weg).
// Elke fout of time-out geeft null of een lege tekst: de aanroeper valt dan terug op de gewone
// transcriptie van de opname na het stoppen (/api/transcribe). Zie docs/VOICE_PLAN.md.

export type LiveState = { tekst: string; definitief: string | null }

type LiveEvent = { type?: string; delta?: string; transcript?: string }

// Puur, zodat het testbaar is zonder browser. delta's bouwen de tussentijdse tekst op,
// 'completed' levert de definitieve tekst voor deze opname (één beurt per opname: turn_detection
// staat uit en de client commit zelf bij stoppen).
export function verwerkLiveEvent(state: LiveState, evt: LiveEvent): LiveState {
  if (evt.type === 'conversation.item.input_audio_transcription.delta' && typeof evt.delta === 'string') {
    return { ...state, tekst: state.tekst + evt.delta }
  }
  if (evt.type === 'conversation.item.input_audio_transcription.completed' && typeof evt.transcript === 'string') {
    return { tekst: state.tekst, definitief: evt.transcript }
  }
  return state
}

export type LiveSessie = {
  // Commit de opname en wacht (maximaal een paar seconden) op de definitieve tekst. Een lege
  // tekst betekent: niet gelukt of niets gehoord, val terug op de gewone transcriptie.
  stop: () => Promise<string>
  // Ruimt alles op zonder de microfoon zelf te stoppen (die is van de aanroeper).
  sluit: () => void
}

const VERBINDEN_MAX_MS = 6000
// Ruim genoeg voor een traag netwerk (VPN) waar het geluid achterloopt. Komt de definitieve tekst
// daarna nog niet binnen, dan nemen we NOOIT de half afgemaakte tussentijdse tekst over (dat brak
// zinnen halverwege af), maar valt alles terug op de gewone transcriptie van de hele opname.
const DEFINITIEF_MAX_MS = 10000
const MAX_BUFFER_BYTES = 24000 * 2 * 8 // 8 seconden geluid wachten op een verbinding is genoeg

function naarBase64(buf: ArrayBuffer): string {
  const u = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + 0x8000)))
  return btoa(s)
}

export async function startLiveTranscriptie(
  stream: MediaStream,
  ctx: AudioContext | null,
  opTekst: (tekst: string) => void,
): Promise<LiveSessie | null> {
  if (!ctx || typeof AudioWorkletNode === 'undefined' || typeof WebSocket === 'undefined') return null
  if (!stream.getAudioTracks()[0]) return null

  let node: AudioWorkletNode | null = null
  let mute: GainNode | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let ws: WebSocket | null = null
  let open = false
  let verbroken = false
  let afgesloten = false
  let state: LiveState = { tekst: '', definitief: null }
  let klaar: ((t: string) => void) | null = null
  let wachtrij: ArrayBuffer[] = []
  let wachtrijBytes = 0

  const sluit = () => {
    afgesloten = true
    try { source?.disconnect() } catch {}
    try { node?.disconnect() } catch {}
    try { mute?.disconnect() } catch {}
    try { if (ws && ws.readyState <= 1) ws.close() } catch {}
    wachtrij = []
    node = null; mute = null; source = null; ws = null
  }
  const stuur = (buf: ArrayBuffer) => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: naarBase64(buf) }))
  }

  try {
    ctx.resume().catch(() => {})
    await ctx.audioWorklet.addModule('/live-opvang.js')
    node = new AudioWorkletNode(ctx, 'live-opvang')
    // Via een gedempte versterker aan de uitgang: sommige browsers (Safari) verwerken een node die
    // nergens op uitkomt niet.
    mute = ctx.createGain()
    mute.gain.value = 0
    node.connect(mute)
    mute.connect(ctx.destination)
    source = ctx.createMediaStreamSource(stream)
    source.connect(node)
    node.port.onmessage = (m: MessageEvent<ArrayBuffer>) => {
      if (afgesloten) return
      if (open) { stuur(m.data); return }
      // Nog geen verbinding: buffer het geluid, zodat het begin van de zin niet verloren gaat.
      if (wachtrijBytes + m.data.byteLength <= MAX_BUFFER_BYTES) { wachtrij.push(m.data); wachtrijBytes += m.data.byteLength }
      else verbroken = true // te lang gewacht, de gewone transcriptie van de opname neemt het over
    }
  } catch {
    sluit()
    return null
  }

  // Verbinden gebeurt op de achtergrond; de opname loopt al.
  void (async () => {
    try {
      const secretRes = await fetch('/api/transcribe/live', { method: 'POST' })
      if (!secretRes.ok) throw new Error('niet_beschikbaar')
      const { value } = await secretRes.json() as { value?: string }
      if (!value || afgesloten) throw new Error('geen_sessiecode')
      const socket = new WebSocket('wss://api.openai.com/v1/realtime?intent=transcription', ['realtime', `openai-insecure-api-key.${value}`])
      ws = socket
      socket.onmessage = (m) => {
        let evt: LiveEvent
        try { evt = JSON.parse(m.data as string) } catch { return }
        const vorige = state.tekst
        state = verwerkLiveEvent(state, evt)
        if (state.tekst !== vorige && !afgesloten) opTekst(state.tekst)
        if (state.definitief !== null && klaar) klaar(state.definitief)
        // Een fout (bijv. lege commit bij stilte) mag het wachten niet laten hangen. Leeg = de
        // gewone transcriptie van de opname neemt het over, nooit een half resultaat.
        if (evt.type === 'error' && klaar) klaar('')
      }
      socket.onclose = () => { open = false; if (!afgesloten) { verbroken = true; if (klaar) klaar('') } }
      socket.onerror = () => { verbroken = true }
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve()
        setTimeout(() => reject(new Error('verbinden_timeout')), VERBINDEN_MAX_MS)
      })
      if (afgesloten) { socket.close(); return }
      open = true
      for (const b of wachtrij) stuur(b)
      wachtrij = []
    } catch {
      verbroken = true
    }
  })()

  return {
    sluit,
    stop: async () => {
      if (afgesloten) return ''
      // Nooit verbonden geraakt (of onderweg verbroken): de gewone transcriptie van de opname
      // neemt het over. Gebeurt vooral bij heel korte opnames.
      if (!open || verbroken) { sluit(); return '' }
      const wachten = new Promise<string>((resolve) => {
        if (state.definitief !== null) return resolve(state.definitief)
        klaar = resolve
      })
      try { ws?.send(JSON.stringify({ type: 'input_audio_buffer.commit' })) } catch {}
      const tekst = await Promise.race([
        wachten,
        new Promise<string>((resolve) => setTimeout(() => resolve(''), DEFINITIEF_MAX_MS)),
      ])
      sluit()
      return tekst
    },
  }
}
