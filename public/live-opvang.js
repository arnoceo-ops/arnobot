// AudioWorklet voor live transcriptie (lib/liveTranscribe.ts). Vangt de microfoon lokaal op,
// brengt hem naar 24 kHz mono PCM16 (wat gpt-live-transcribe verwacht) en geeft hem in stukjes
// van 50 ms door aan de hoofdthread. Doordat het geluid hier meteen wordt opgevangen, gaat er
// niets verloren terwijl de verbinding met OpenAI nog opstart: de hoofdthread buffert het.
class LiveOpvang extends AudioWorkletProcessor {
  constructor() {
    super()
    this.ratio = sampleRate / 24000
    this.pos = 0
    this.prev = 0
    this.uit = new Int16Array(1200)
    this.n = 0
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (!ch || ch.length === 0) return true
    const len = ch.length
    // Posities zijn relatief aan het begin van dit blok, -1 is de laatste sample van het vorige.
    while (this.pos < len - 1) {
      const i = Math.floor(this.pos)
      const f = this.pos - i
      const a = i < 0 ? this.prev : ch[i]
      const b = ch[i + 1]
      const v = a + (b - a) * f
      this.uit[this.n++] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)))
      if (this.n === this.uit.length) {
        const buf = this.uit.buffer
        this.port.postMessage(buf, [buf])
        this.uit = new Int16Array(1200)
        this.n = 0
      }
      this.pos += this.ratio
    }
    this.pos -= len
    this.prev = ch[len - 1]
    return true
  }
}

registerProcessor('live-opvang', LiveOpvang)
