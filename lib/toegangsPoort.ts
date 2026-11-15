import { NextResponse } from 'next/server'
import { heeftToegangNu } from '@/lib/toegangNu'
import { isInternalTestUser } from '@/lib/internalTestAccounts'

// De toegangscontrole voor API-routes die geld kosten (chat, stem-chat, sparren). Geeft een 403-antwoord terug als de
// gebruiker geen toegang meer heeft, anders null. Zet hem direct na de controle op inloggen, vóór er iets geld kost.
// De eigenaar en interne testaccounts slaan hem over: hun toegang loopt niet via datums (docs/TEAM_PROCES.md).
// De regels zelf staan in lib/toegangNu.ts.
export async function toegangsWeigering(userId: string, headers?: Record<string, string>): Promise<NextResponse | null> {
  if (userId === process.env.ARNOBOT_OWNER_USER_ID || isInternalTestUser(userId)) return null
  if (await heeftToegangNu(userId)) return null
  return NextResponse.json({ error: 'geen_toegang' }, { status: 403, headers })
}
