// LEIDERSCHAP-kaart op /bot voor een bevestigde teambaas: biedt de SPE-analyse (Mijn leiderschap)
// aan zodra die volgens lib/speAnalyse.ts mogelijk is. Data-gedreven, niet de AI-classificatie van
// de gewone GROEIKANS-kaart: die kent de 1:1's niet. Alleen server-side aanroepen.
import type { SupabaseClient } from '@supabase/supabase-js'
import { speAnalyseStatus } from '@/lib/speAnalyse'

export type SpeKaart = {
  label: string
  tekst: string
  knop: string
  href: string
  aantal1on1s: number
  /** null = nog geen eerdere analyse */
  nieuw: number | null
}

export async function bepaalSpeKaart(db: SupabaseClient, userId: string): Promise<SpeKaart | null> {
  const { data: managerMember } = await db
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('role', 'manager')
    .maybeSingle()
  if (!managerMember) return null

  const [membersRes, logsRes, prevRes] = await Promise.all([
    db.from('arnobot_team_members').select('user_id').eq('team_id', managerMember.team_id).neq('role', 'manager').limit(1),
    // Zelfde selectie en limiet als POST /api/bot/team/zelfcoaching, anders loopt de telling uit de pas.
    db.from('arnobot_1on1_log').select('id').eq('manager_id', userId).order('created_at', { ascending: false }).limit(60),
    db.from('arnobot_salesbaas_coaching').select('updated_at, used_1on1_ids').eq('user_id', userId).maybeSingle(),
  ])
  if (membersRes.error || logsRes.error || prevRes.error) return null

  const status = speAnalyseStatus({
    heeftTeamleden: (membersRes.data ?? []).length > 0,
    logIds: (logsRes.data ?? []).map(l => l.id as string),
    vorige: prevRes.data ? { updatedAt: prevRes.data.updated_at as string, usedIds: (prevRes.data.used_1on1_ids as string[] | null) ?? [] } : null,
  })
  if (!status.mogelijk) return null

  return {
    label: 'LEIDERSCHAP',
    tekst: status.eerdereAnalyse
      ? `Sinds je laatste analyse zijn er ${status.nieuw} nieuwe 1:1's. Tijd om te zien wat er in je leiderschap is verschoven.`
      : `Je hebt al ${status.totaal} 1:1's gevoerd. Laat ArnoBot zien welke patronen daarin zitten, in strategie, mensen en uitvoering.`,
    knop: 'COACH ME',
    href: '/bot/coaching?start=1',
    aantal1on1s: status.totaal,
    nieuw: status.eerdereAnalyse ? status.nieuw : null,
  }
}
