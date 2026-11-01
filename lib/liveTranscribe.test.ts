import { describe, it, expect } from 'vitest'
import { verwerkLiveEvent, type LiveState } from '@/lib/liveTranscribe'

const leeg: LiveState = { tekst: '', definitief: null }
const D = 'conversation.item.input_audio_transcription.delta'
const C = 'conversation.item.input_audio_transcription.completed'

describe('verwerkLiveEvent', () => {
  it('bouwt de tussentijdse tekst op uit delta-events', () => {
    let s = leeg
    s = verwerkLiveEvent(s, { type: D, delta: 'Ik heb ' })
    s = verwerkLiveEvent(s, { type: D, delta: 'gebeld' })
    expect(s.tekst).toBe('Ik heb gebeld')
    expect(s.definitief).toBeNull()
  })
  it('neemt de definitieve tekst over bij completed, en laat de tussentijdse staan', () => {
    let s = verwerkLiveEvent(leeg, { type: D, delta: 'Ik heb' })
    s = verwerkLiveEvent(s, { type: C, transcript: 'Ik heb gebeld.' })
    expect(s.definitief).toBe('Ik heb gebeld.')
    expect(s.tekst).toBe('Ik heb')
  })
  it('negeert onbekende events en events zonder tekstveld', () => {
    expect(verwerkLiveEvent(leeg, { type: 'session.created' })).toBe(leeg)
    expect(verwerkLiveEvent(leeg, { type: D })).toBe(leeg)
    expect(verwerkLiveEvent(leeg, { type: C })).toBe(leeg)
  })
  it('een lege definitieve tekst blijft een lege string en geen null (stilte)', () => {
    const s = verwerkLiveEvent(leeg, { type: C, transcript: '' })
    expect(s.definitief).toBe('')
  })
})
