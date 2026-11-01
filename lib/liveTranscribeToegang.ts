import { INTERNAL_TEST_USER_IDS } from '@/lib/internalTestAccounts'

// Live transcriptie (gpt-live-transcribe via WebRTC) is nieuw en staat standaard alleen aan voor
// de eigenaar en de interne testaccounts. Zet LIVE_TRANSCRIBE=aan in Vercel om het voor
// iedereen open te zetten. Zonder toegang valt de client stil terug op de gewone transcriptie
// na het stoppen (/api/transcribe), dus spraak valt voor niemand uit.
export function liveTranscribeBeschikbaarVoor(userId: string): boolean {
  if (process.env.LIVE_TRANSCRIBE === 'aan') return true
  const eigenaar = process.env.ARNOBOT_OWNER_USER_ID
  return INTERNAL_TEST_USER_IDS.includes(userId) || (!!eigenaar && eigenaar === userId)
}
