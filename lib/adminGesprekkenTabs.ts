import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { INTERNAL_TEST_USERS_IN, FAKE_DEMO_USER_LIKE } from '@/lib/internalTestAccounts'
import { ontwikkelpuntTekst, type Ontwikkelpunt } from '@/lib/coachingTekst'
import { nlDagStartIso, nlDagEindeIso, nlDatumTekst, nlTijdTekst } from '@/lib/nlTijd'

// Data voor de tabs Analyses en Coaching op /bot/admin (Gesprekken-pagina). Alleen lezen,
// alleen voor de admin (de pagina en de CSV-route controleren de admin-cookie zelf).

export type AnalyseRij = {
  id: string
  user_id: string
  created_at: string
  analyse_text: string | null
  session_count: number | null
}

// Eén coachingrapportage. Komt uit arnobot_coaching_history. Rapportages van vóór 2026-11-13
// hebben daar alleen scores, diagnoses en voortgang; de laatste ervan wordt aangevuld uit de
// live rij in arnobot_coaching (die bij elke nieuwe rapportage wordt overschreven).
export type CoachingVersie = {
  id: string
  user_id: string
  created_at: string
  mindset_score: number | null
  mindset_diagnose: string | null
  mindset_richting: string | null
  systeem_score: number | null
  systeem_diagnose: string | null
  systeem_richting: string | null
  actie_score: number | null
  actie_diagnose: string | null
  actie_richting: string | null
  voortgang: string | null
  ontwikkelpunten: Ontwikkelpunt[] | null
  signalen: string[] | null
  blogs: { title?: string; url?: string; reden?: string }[] | null
  weinig_voortgang: boolean | null
  stagnatie: boolean | null
  conversation_count: number | null
  volledig: boolean
}

type DatumFilter = { from?: string; to?: string; userFilter?: string }

const MAX_RIJEN = 300

function client(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function fetchAnalyses({ from, to, userFilter }: DatumFilter): Promise<AnalyseRij[]> {
  let q = client()
    .from('arnobot_analyses')
    .select('id, user_id, created_at, analyse_text, session_count')
    .not('user_id', 'in', INTERNAL_TEST_USERS_IN)
    .not('user_id', 'like', FAKE_DEMO_USER_LIKE)
    .order('created_at', { ascending: false })
    .limit(MAX_RIJEN)
  if (userFilter) q = q.eq('user_id', userFilter)
  if (from) q = q.gte('created_at', nlDagStartIso(from))
  if (to) q = q.lt('created_at', nlDagEindeIso(to))
  const { data } = await q
  return (data ?? []) as AnalyseRij[]
}

const LIVE_VELDEN =
  'user_id, updated_at, mindset_richting, systeem_richting, actie_richting, ontwikkelpunten, signalen, blogs, weinig_voortgang, stagnatie, conversation_count'

export async function fetchCoachingVersies({ from, to, userFilter }: DatumFilter): Promise<CoachingVersie[]> {
  const supabase = client()
  let q = supabase
    .from('arnobot_coaching_history')
    .select('*')
    .not('user_id', 'in', INTERNAL_TEST_USERS_IN)
    .not('user_id', 'like', FAKE_DEMO_USER_LIKE)
    .order('created_at', { ascending: false })
    .limit(MAX_RIJEN)
  if (userFilter) q = q.eq('user_id', userFilter)
  if (from) q = q.gte('created_at', nlDagStartIso(from))
  if (to) q = q.lt('created_at', nlDagEindeIso(to))
  const { data: historie } = await q
  const rijen = (historie ?? []) as Record<string, unknown>[]

  // Oude historierijen (zonder ontwikkelpunten) aanvullen met de live rij, maar alleen als
  // die bij dezelfde rapportage hoort: de historie-insert volgt de live-update binnen enkele
  // seconden. Een live rij van een latere rapportage mag nooit over een oudere versie heen.
  const nodigVoorAanvulling = rijen.filter(r => r.ontwikkelpunten == null)
  let live: Record<string, Record<string, unknown>> = {}
  if (nodigVoorAanvulling.length > 0) {
    const ids = [...new Set(nodigVoorAanvulling.map(r => String(r.user_id)))]
    const { data } = await supabase.from('arnobot_coaching').select(LIVE_VELDEN).in('user_id', ids)
    live = Object.fromEntries((data ?? []).map(r => [String((r as { user_id: string }).user_id), r as Record<string, unknown>]))
  }

  return rijen.map(r => {
    let v = r
    if (r.ontwikkelpunten == null) {
      const l = live[String(r.user_id)]
      const verschil = l ? new Date(String(r.created_at)).getTime() - new Date(String(l.updated_at)).getTime() : NaN
      if (l && verschil >= 0 && verschil < 120_000) v = { ...l, ...r, ontwikkelpunten: l.ontwikkelpunten, signalen: l.signalen, blogs: l.blogs, weinig_voortgang: l.weinig_voortgang, stagnatie: l.stagnatie, conversation_count: l.conversation_count, mindset_richting: l.mindset_richting, systeem_richting: l.systeem_richting, actie_richting: l.actie_richting }
    }
    return {
      id: String(v.id),
      user_id: String(v.user_id),
      created_at: String(v.created_at),
      mindset_score: (v.mindset_score as number) ?? null,
      mindset_diagnose: (v.mindset_diagnose as string) ?? null,
      mindset_richting: (v.mindset_richting as string) ?? null,
      systeem_score: (v.systeem_score as number) ?? null,
      systeem_diagnose: (v.systeem_diagnose as string) ?? null,
      systeem_richting: (v.systeem_richting as string) ?? null,
      actie_score: (v.actie_score as number) ?? null,
      actie_diagnose: (v.actie_diagnose as string) ?? null,
      actie_richting: (v.actie_richting as string) ?? null,
      voortgang: (v.voortgang as string) ?? null,
      ontwikkelpunten: (v.ontwikkelpunten as Ontwikkelpunt[]) ?? null,
      signalen: (v.signalen as string[]) ?? null,
      blogs: (v.blogs as CoachingVersie['blogs']) ?? null,
      weinig_voortgang: (v.weinig_voortgang as boolean) ?? null,
      stagnatie: (v.stagnatie as boolean) ?? null,
      conversation_count: (v.conversation_count as number) ?? null,
      volledig: v.ontwikkelpunten != null,
    }
  })
}

function datumTijd(iso: string): string {
  return `${nlDatumTekst(iso)} ${nlTijdTekst(iso)}`
}

export function analyseAsText(a: AnalyseRij, naam?: string): string {
  return `ANALYSE · ${datumTijd(a.created_at)}${naam ? ' · ' + naam : ''}${a.session_count ? ` · ${a.session_count} gesprekken` : ''}\n\n${a.analyse_text ?? ''}`
}

export function coachingAsText(v: CoachingVersie, naam?: string): string {
  const regels: string[] = [`COACHING · ${datumTijd(v.created_at)}${naam ? ' · ' + naam : ''}${v.conversation_count ? ` · ${v.conversation_count} gesprekken` : ''}`, '']
  const pijlers: [string, number | null, string | null, string | null][] = [
    ['MINDSET', v.mindset_score, v.mindset_richting, v.mindset_diagnose],
    ['SYSTEEM', v.systeem_score, v.systeem_richting, v.systeem_diagnose],
    ['ACTIE', v.actie_score, v.actie_richting, v.actie_diagnose],
  ]
  for (const [naamPijler, score, richting, diagnose] of pijlers) {
    regels.push(`${naamPijler}: ${score ?? '-'}${richting ? ` (${richting})` : ''}`)
    if (diagnose) regels.push(diagnose)
    regels.push('')
  }
  if (v.voortgang) regels.push('VOORTGANG', v.voortgang, '')
  if (v.ontwikkelpunten?.length) {
    regels.push('ONTWIKKELPUNTEN')
    v.ontwikkelpunten.forEach((p, i) => {
      const { tekst, pijlar } = ontwikkelpuntTekst(p)
      regels.push(`${i + 1}. ${pijlar ? `[${pijlar}] ` : ''}${tekst}`)
    })
    regels.push('')
  }
  if (v.signalen?.length) regels.push('SIGNALEN', ...v.signalen.map(s => `- ${s}`), '')
  if (v.blogs?.length) regels.push('BLOGTIPS', ...v.blogs.map(b => `- ${b.title ?? ''} ${b.url ?? ''}${b.reden ? ' : ' + b.reden : ''}`), '')
  if (v.stagnatie) regels.push('STAGNATIE: ja')
  else if (v.weinig_voortgang) regels.push('WEINIG VOORTGANG: ja')
  if (!v.volledig) regels.push('(Van deze rapportage zijn alleen scores, diagnoses en voortgang bewaard.)')
  return regels.join('\n').trim()
}

function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return ''
  const s = String(val).replace(/"/g, '""')
  return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s
}

export function analysesCsv(rijen: AnalyseRij[], naamMap: Record<string, string>): string {
  const regels = [['datum', 'tijd', 'gebruiker', 'aantal_gesprekken', 'analyse'].join(',')]
  for (const a of rijen) {
    regels.push([nlDatumTekst(a.created_at), nlTijdTekst(a.created_at), naamMap[a.user_id] || a.user_id, a.session_count, a.analyse_text].map(escapeCSV).join(','))
  }
  return regels.join('\n')
}

export function coachingCsv(rijen: CoachingVersie[], naamMap: Record<string, string>): string {
  const kop = ['datum', 'tijd', 'gebruiker', 'mindset_score', 'mindset_richting', 'mindset_diagnose', 'systeem_score', 'systeem_richting', 'systeem_diagnose', 'actie_score', 'actie_richting', 'actie_diagnose', 'voortgang', 'ontwikkelpunten', 'signalen', 'blogtips', 'weinig_voortgang', 'stagnatie', 'aantal_gesprekken']
  const regels = [kop.join(',')]
  for (const v of rijen) {
    regels.push([
      nlDatumTekst(v.created_at), nlTijdTekst(v.created_at), naamMap[v.user_id] || v.user_id,
      v.mindset_score, v.mindset_richting, v.mindset_diagnose,
      v.systeem_score, v.systeem_richting, v.systeem_diagnose,
      v.actie_score, v.actie_richting, v.actie_diagnose,
      v.voortgang,
      (v.ontwikkelpunten ?? []).map(p => { const o = ontwikkelpuntTekst(p); return o.pijlar ? `[${o.pijlar}] ${o.tekst}` : o.tekst }).join(' | '),
      (v.signalen ?? []).join(' | '),
      (v.blogs ?? []).map(b => b.url ?? b.title ?? '').join(' | '),
      v.weinig_voortgang === null ? '' : v.weinig_voortgang ? 'ja' : 'nee',
      v.stagnatie === null ? '' : v.stagnatie ? 'ja' : 'nee',
      v.conversation_count,
    ].map(escapeCSV).join(','))
  }
  return regels.join('\n')
}
