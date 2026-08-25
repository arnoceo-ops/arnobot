import { createClient } from '@supabase/supabase-js'
import { computeSpiegelSignaal, formatSystemischSignaal } from '@/lib/spiegel'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Volledige, ongefilterde databundel over één gebruiker voor de admin-ANALYSE-tab
// (`/bot/admin/analyse`). Arno is hier de enige uitzondering op "nooit ruwe gesprekken
// tonen aan een manager" (docs/TEAM_PLAN.md): hij is geen manager, hij is de enige admin,
// en niets hiervan verlaat de admin-omgeving. Gedeeld tussen de analyse-generatie en de
// doorvraag-chat zodat beide exact dezelfde grondslag gebruiken.
const SESSIES_LIMIET = 40
const RUWE_GESPREKKEN_LIMIET = 60
const SPARRING_LIMIET = 10

export type AdminAnalyseContext = {
  naam: string
  email: string | null
  plan: string
  isTeamManager: boolean
  isTeamLid: boolean
  teamNaam: string | null
  contextText: string
}

type ProfielVeld = string | string[] | undefined

function formatProfiel(profiel: Record<string, ProfielVeld> | null): string {
  if (!profiel) return 'Geen profiel ingevuld.'
  const regel = (label: string, key: string) => {
    const v = profiel[key]
    if (!v || (Array.isArray(v) && v.length === 0)) return null
    return `${label}: ${Array.isArray(v) ? v.join(', ') : v}`
  }
  const regels = [
    regel('Rol', 'rol'),
    regel('Markt', 'markt'),
    regel('Wat verkoopt hij/zij', 'wat_verkoop_je'),
    regel('Ideale klant', 'ideale_klant'),
    regel('Grootste uitdaging', 'uitdaging'),
    regel('Gemiddelde dealgrootte', 'dealgrootte'),
    regel('Salescyclus', 'salescyclus'),
    regel('Target dit jaar', 'target_dit_jaar'),
    regel('Target over 3 jaar', 'target_3_jaar'),
    regel('Teamgrootte', 'teamgrootte'),
    regel('Jaren in sales', 'jaren_sales'),
    regel('Jaren in huidige functie', 'jaren_functie'),
  ].filter(Boolean)
  return regels.length ? regels.join('\n') : 'Geen profiel ingevuld.'
}

export async function gatherAdminAnalyseContext(targetUserId: string): Promise<AdminAnalyseContext | null> {
  const [userRes, profielRes, sessiesRes, logsRes, coachingRes, analysesRes, sparringRes, teamMemberRes] = await Promise.all([
    supabase.from('approved_users').select('user_id, email, full_name, voornaam, achternaam, plan, created_at').eq('user_id', targetUserId).maybeSingle(),
    supabase.from('arnobot_blog_profiles').select('profiel').eq('user_id', targetUserId).maybeSingle(),
    supabase.from('arnobot_blog_sessions').select('title, summary, feiten, uitdaging, themas, actie_status, excuustaal, created_at')
      .eq('user_id', targetUserId).is('deleted_at', null).order('created_at', { ascending: false }).limit(SESSIES_LIMIET),
    supabase.from('arnobot_rds_logs').select('question, answer, created_at')
      .eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(RUWE_GESPREKKEN_LIMIET),
    supabase.from('arnobot_coaching').select('*').eq('user_id', targetUserId).maybeSingle(),
    supabase.from('arnobot_analyses').select('analyse_text, created_at')
      .eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(5),
    supabase.from('arnobot_sparring_sessions').select('debrief, persona, rol_categorie, created_at')
      .eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(SPARRING_LIMIET),
    supabase.from('arnobot_team_members').select('team_id, role, display_name, arnobot_teams(name)').eq('user_id', targetUserId).maybeSingle(),
  ])

  const user = userRes.data
  if (!user) return null

  const naam = user.full_name || [user.voornaam, user.achternaam].filter(Boolean).join(' ') || user.email || 'Onbekend'
  const profielTekst = formatProfiel((profielRes.data?.profiel as Record<string, ProfielVeld>) ?? null)

  const sessies = sessiesRes.data ?? []
  const sessiesTekst = sessies.length
    ? sessies.map((s, i) => {
        const delen = [`${i + 1}. (${new Date(s.created_at).toLocaleDateString('nl-NL')}) ${s.title}`]
        if (s.summary) delen.push(`Terugblik: ${s.summary}`)
        if (s.feiten) delen.push(`Feiten: ${s.feiten}`)
        if (s.uitdaging) delen.push(`Actie: ${s.uitdaging} (status: ${s.actie_status ?? 'onbeantwoord'})`)
        if (s.themas?.length) delen.push(`Thema's: ${s.themas.join(', ')}`)
        if (s.excuustaal) delen.push('Excuustaal gedetecteerd in dit gesprek.')
        return delen.join('\n')
      }).join('\n\n')
    : 'Geen sessies gevonden.'

  const logs = [...(logsRes.data ?? [])].reverse()
  const logsTekst = logs.length
    ? logs.map(l => `V: ${l.question}\nA: ${l.answer}`).join('\n\n')
    : 'Geen losse vraag-antwoordparen gevonden.'

  const coaching = coachingRes.data
  const coachingTekst = coaching
    ? `Mindset: score ${coaching.mindset_score ?? 'n.v.t.'}, diagnose: ${coaching.mindset_diagnose ?? 'n.v.t.'}\nSysteem: score ${coaching.systeem_score ?? 'n.v.t.'}, diagnose: ${coaching.systeem_diagnose ?? 'n.v.t.'}\nActie: score ${coaching.actie_score ?? 'n.v.t.'}, diagnose: ${coaching.actie_diagnose ?? 'n.v.t.'}\nOntwikkelpunten: ${coaching.ontwikkelpunten ?? 'n.v.t.'}\nWeinig voortgang: ${coaching.weinig_voortgang ? 'ja' : 'nee'}, stagnatie: ${coaching.stagnatie ? 'ja' : 'nee'}`
    : 'Nog geen coachingsynthese beschikbaar.'

  const analyses = analysesRes.data ?? []
  const analysesTekst = analyses.length
    ? analyses.map(a => `(${new Date(a.created_at).toLocaleDateString('nl-NL')}) ${a.analyse_text}`).join('\n\n')
    : 'Geen eerdere zelf-analyses.'

  const sparring = sparringRes.data ?? []
  const sparringTekst = sparring.length
    ? sparring.map(s => `(${new Date(s.created_at).toLocaleDateString('nl-NL')}, tegen ${s.persona ?? s.rol_categorie ?? 'onbekende rol'}) ${s.debrief ?? 'geen debrief'}`).join('\n\n')
    : 'Geen sparringsessies.'

  let teamTekst = 'Geen teamlid.'
  let isTeamManager = false
  let isTeamLid = false
  let teamNaam: string | null = null
  const teamMember = teamMemberRes.data as unknown as { team_id: string; role: string; display_name: string | null; arnobot_teams: { name: string } | null } | null

  if (teamMember) {
    teamNaam = teamMember.arnobot_teams?.name ?? null
    isTeamManager = teamMember.role === 'manager'
    isTeamLid = !isTeamManager

    if (isTeamManager) {
      const { data: leden } = await supabase
        .from('arnobot_team_members')
        .select('user_id, display_name')
        .eq('team_id', teamMember.team_id)
        .neq('role', 'manager')
      const memberIds = (leden ?? []).map(l => l.user_id)
      const [spiegel, laatsteTeamAnalyseRes] = await Promise.all([
        computeSpiegelSignaal(memberIds),
        supabase.from('arnobot_team_analyses').select('analyse_text, created_at')
          .eq('team_id', teamMember.team_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      const systemischSignaal = formatSystemischSignaal(spiegel)
      const ledenNamen = (leden ?? []).map(l => l.display_name).filter(Boolean).join(', ') || 'geen namen bekend'
      const laatsteTeamAnalyse = laatsteTeamAnalyseRes.data
      teamTekst = `Teambaas van team "${teamNaam ?? 'onbekend'}", ${memberIds.length} teamleden: ${ledenNamen}.\n${systemischSignaal ? `Systemisch signaal: ${systemischSignaal}` : 'Geen systemisch signaal actief.'}${laatsteTeamAnalyse ? `\nLaatste teamanalyse (${new Date(laatsteTeamAnalyse.created_at).toLocaleDateString('nl-NL')}): ${laatsteTeamAnalyse.analyse_text}` : ''}`
    } else {
      teamTekst = `Teamlid van team "${teamNaam ?? 'onbekend'}".`
    }
  }

  const contextText = `ACCOUNT
Naam: ${naam}
E-mail: ${user.email ?? 'onbekend'}
Plan: ${user.plan ?? 'onbekend'}
Klant sinds: ${user.created_at ? new Date(user.created_at).toLocaleDateString('nl-NL') : 'onbekend'}

PROFIEL
${profielTekst}

TEAMCONTEXT
${teamTekst}

COACHINGSYNTHESE
${coachingTekst}

EERDERE ZELF-ANALYSES (door de gebruiker zelf opgevraagd, over zichzelf)
${analysesTekst}

SESSIES (laatste ${sessies.length})
${sessiesTekst}

RUWE VRAAG-ANTWOORDPAREN, CHRONOLOGISCH (laatste ${logs.length})
${logsTekst}

SPARRINGSESSIES (laatste ${sparring.length})
${sparringTekst}`

  return {
    naam,
    email: user.email ?? null,
    plan: user.plan ?? 'basis',
    isTeamManager,
    isTeamLid,
    teamNaam,
    contextText,
  }
}
