// De gegevens voor de kostenmelding (lib/kostenAlarm.ts): wie betaalt er, hoeveel per maand, en wat kostte die klant in een kalendermaand.
// Alleen lezen.
import type { SupabaseClient } from '@supabase/supabase-js'
import { haalAlleRijen } from '@/lib/haalAlleRijen'
import { amsterdamDagStart } from '@/lib/amsterdamTijd'
import { somKostenPerGebruiker, type KostenRij } from '@/lib/gebruikerKosten'
import { FOUNDER_USER_ID, TEST_TEAM_IDS, isInternalTestUser } from '@/lib/internalTestAccounts'
import { soloKlanten, teamPerMaandCent, type Abonnement, type Betaling, type Klant, type TeamFactuur } from '@/lib/kostenAlarm'

/** Testaccounts, demo-nepleden en Arno zelf zijn geen klant. */
function geenKlant(userId: string): boolean {
  return isInternalTestUser(userId) || userId === FOUNDER_USER_ID || userId === process.env.ARNOBOT_OWNER_USER_ID
}

export async function haalBetalendeKlanten(db: SupabaseClient, nu: Date): Promise<Klant[]> {
  const [abonnementen, betalingen, facturen, teams, leden] = await Promise.all([
    haalAlleRijen<Abonnement>((van, tot) =>
      db.from('arnobot_subscriptions').select('id, user_id, plan, cyclus, status, bedrag_cent, btw_cent, periode_einde')
        .in('status', ['active', 'cancelled']).order('id', { ascending: true }).range(van, tot)),
    haalAlleRijen<Betaling>((van, tot) =>
      // Alle kolommen: de momentopname (cyclus) ontbreekt bij oude rijen.
      db.from('arnobot_payments').select('*').eq('status', 'paid').order('id', { ascending: true }).range(van, tot)),
    haalAlleRijen<TeamFactuur>((van, tot) =>
      db.from('arnobot_team_facturen').select('*').eq('status', 'paid').order('id', { ascending: true }).range(van, tot)),
    haalAlleRijen<{ id: string; name: string | null; manager_id: string }>((van, tot) =>
      db.from('arnobot_teams').select('id, name, manager_id').order('id', { ascending: true }).range(van, tot)),
    haalAlleRijen<{ team_id: string; user_id: string }>((van, tot) =>
      db.from('arnobot_team_members').select('team_id, user_id').order('team_id', { ascending: true }).order('user_id', { ascending: true }).range(van, tot)),
  ])

  const solo = soloKlanten(abonnementen.filter(a => !geenKlant(a.user_id)), betalingen, nu)
  const metEigenAbonnement = new Set(solo.map(k => k.sleutel))

  const teamKlanten: Klant[] = []
  for (const team of teams) {
    if ((TEST_TEAM_IDS as readonly string[]).includes(team.id)) continue
    const perMaandCent = teamPerMaandCent(facturen.filter(f => f.team_id === team.id), nu)
    if (perMaandCent === null) continue
    // Een lid met een eigen betaald abonnement telt daar al, niet nog een keer bij het team.
    const userIds = [...new Set([team.manager_id, ...leden.filter(l => l.team_id === team.id).map(l => l.user_id)])]
      .filter(id => !geenKlant(id) && !metEigenAbonnement.has(id))
    teamKlanten.push({ sleutel: `team:${team.id}`, userIds, perMaandCent, omschrijving: `Team ${team.name ?? ''}, ${userIds.length} gebruikers`.replace('  ', ' ') })
  }
  return [...solo, ...teamKlanten]
}

/** Gemeten kosten in dollars per gebruiker in een kalendermaand (Amsterdamse tijd). `maand` is "JJJJ-MM-01". */
export async function haalMaandKostenPerGebruiker(db: SupabaseClient, maand: string, volgendeMaand: string): Promise<Map<string, number>> {
  const start = amsterdamDagStart(maand)
  const eind = amsterdamDagStart(volgendeMaand)
  const [rijen, voice] = await Promise.all([
    haalAlleRijen<KostenRij>((van, tot) =>
      db.from('arnobot_ai_gebruik').select('user_id, model, kosten_usd').not('user_id', 'is', null)
        .gte('created_at', start).lt('created_at', eind).order('id', { ascending: true }).range(van, tot)),
    haalAlleRijen<{ user_id: string | null; char_count: number | null }>((van, tot) =>
      db.from('arnobot_elevenlabs_usage').select('user_id, char_count')
        .gte('created_at', start).lt('created_at', eind).order('id', { ascending: true }).range(van, tot)),
  ])
  return new Map([...somKostenPerGebruiker(rijen, voice)].map(([id, k]) => [id, k.totaalUsd]))
}
