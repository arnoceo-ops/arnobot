export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { getRelevantChunks } from '@/lib/rag'
import { computeSpeScore } from '@/lib/msa'
import { isConfirmedTeambaas } from '@/lib/teamAccess'
import { computeSpiegelSignaal } from '@/lib/spiegel'
import { RULE_ENGLISH_TERMS, RULE_NO_CRUDE_LANGUAGE, RULE_NEVER_BREAK_CHARACTER, RULE_NO_INVENTED_DETAILS, RULE_NO_DASH } from '@/lib/systemPrompt'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const COOLDOWN_DAGEN = 14
const MIN_NIEUWE_1ON1S = 3

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const [{ data, error }, { data: history, error: historyError }] = await Promise.all([
    supabase
      .from('arnobot_salesbaas_coaching')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('arnobot_salesbaas_coaching_history')
      .select('id, strategy_score, strategy_diagnose, people_score, people_diagnose, execution_score, execution_diagnose, voortgang, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ])

  if (error) console.error('[zelfcoaching GET]', error.message)
  if (historyError) console.error('[zelfcoaching GET history]', historyError.message)
  return NextResponse.json({ coaching: data ?? null, history: history ?? [] })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (!await isConfirmedTeambaas(userId)) return NextResponse.json({ error: 'geen_teambaas_toegang' }, { status: 403 })

  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id, arnobot_teams(name)')
    .eq('user_id', userId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ error: 'geen_teambaas_toegang' }, { status: 403 })

  const team = managerMember.arnobot_teams as unknown as { name: string }

  const { data: members } = await supabase
    .from('arnobot_team_members')
    .select('user_id')
    .eq('team_id', managerMember.team_id)
    .neq('role', 'manager')

  const memberIds = (members ?? []).map(m => m.user_id)
  if (memberIds.length === 0) return NextResponse.json({ error: 'geen_teamleden' }, { status: 400 })

  const [logsRes, prevRes] = await Promise.all([
    supabase
      .from('arnobot_1on1_log')
      .select('id, member_id, created_at, agenda, aandachtspunt, actie, actie_status, notitie')
      .eq('manager_id', userId)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('arnobot_salesbaas_coaching')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const logs = logsRes.data ?? []
  const prev = prevRes.data

  if (logs.length < MIN_NIEUWE_1ON1S) {
    return NextResponse.json({ error: 'te_weinig', count: logs.length, benodigd: MIN_NIEUWE_1ON1S }, { status: 400 })
  }

  const prevUsedIds = new Set<string>((prev?.used_1on1_ids as string[] | null) ?? [])
  const newLogs = logs.filter(l => !prevUsedIds.has(l.id))

  if (prev) {
    const daysSince = (Date.now() - new Date(prev.updated_at).getTime()) / 86400000
    if (daysSince < COOLDOWN_DAGEN || newLogs.length < MIN_NIEUWE_1ON1S) {
      return NextResponse.json({
        error: 'te_vroeg',
        dagenResterend: Math.max(0, Math.ceil(COOLDOWN_DAGEN - daysSince)),
        nieuweEenOpEens: newLogs.length,
        benodigd: MIN_NIEUWE_1ON1S,
      }, { status: 429 })
    }
  }

  const [sessionsRes, scoresRes, coachingRes, spotlightRes, spiegel, eigenSessiesRes] = await Promise.all([
    supabase
      .from('arnobot_blog_sessions')
      .select('user_id, summary, feiten')
      .in('user_id', memberIds)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('arnobot_coaching_scores')
      .select('mindset_score, systeem_score, actie_score, created_at')
      .in('user_id', memberIds)
      .order('created_at', { ascending: true })
      .limit(300),
    supabase
      .from('arnobot_coaching')
      .select('user_id, mindset_score, mindset_diagnose, systeem_score, systeem_diagnose, actie_score, actie_diagnose')
      .in('user_id', memberIds),
    supabase
      .from('arnobot_team_analyses')
      .select('analyse_text, created_at')
      .eq('team_id', managerMember.team_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    computeSpiegelSignaal(memberIds),
    // Zijn eigen gesprekken op ArnoBot (bijv. via de STRATEGY/PEOPLE/EXECUTION-discipline-picker
    // op de hoofdchat), naast 1:1's en teamdata. Bij een verkoper voedt elk gesprek al zijn
    // coachingprofiel, dit haalt de teambaas op gelijke voet: zijn eigen reflectie telt nu ook
    // mee, niet alleen wat hij over zijn team registreert.
    supabase
      .from('arnobot_blog_sessions')
      .select('summary, feiten')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  // Teamresultaten-trend (maandgemiddelden), zelfde berekening als team/spotlight/route.ts
  const byMonth: Record<string, { mindset: number[]; systeem: number[]; actie: number[] }> = {}
  for (const s of scoresRes.data ?? []) {
    const month = s.created_at.slice(0, 7)
    if (!byMonth[month]) byMonth[month] = { mindset: [], systeem: [], actie: [] }
    if (s.mindset_score) byMonth[month].mindset.push(s.mindset_score)
    if (s.systeem_score) byMonth[month].systeem.push(s.systeem_score)
    if (s.actie_score) byMonth[month].actie.push(s.actie_score)
  }
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null
  const maanden = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const trendRegels = Object.entries(byMonth)
    .slice(-6)
    .map(([month, d]) => {
      const m = avg(d.mindset), s = avg(d.systeem), a = avg(d.actie)
      const label = `${maanden[parseInt(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
      return `${label}: Mindset ${m ?? '?'} / Systeem ${s ?? '?'} / Actie ${a ?? '?'}`
    })
    .join('\n')
  const trendContext = trendRegels ? `\n\nTEAMRESULTATEN OVER TIJD (gemiddeld per maand):\n${trendRegels}` : ''

  // Per teamlid het laatste coachingprofiel, al manager-zichtbare data (privacymodel), nu
  // gebundeld ingezet voor de People-diagnose i.p.v. alleen een geaggregeerd getal.
  const ledenProfielText = (coachingRes.data ?? [])
    .map(c => `- Mindset ${c.mindset_score ?? '?'}/5 (${c.mindset_diagnose ?? 'geen diagnose'}), Systeem ${c.systeem_score ?? '?'}/5 (${c.systeem_diagnose ?? 'geen diagnose'}), Actie ${c.actie_score ?? '?'}/5 (${c.actie_diagnose ?? 'geen diagnose'})`)
    .join('\n')

  const sessieText = (sessionsRes.data ?? [])
    .filter(s => s.summary)
    .map(s => `- ${s.summary}${s.feiten ? '\n  Feiten: ' + s.feiten.slice(0, 200) : ''}`)
    .join('\n')
    .slice(0, 5000)

  const eigenSessiesText = (eigenSessiesRes.data ?? [])
    .filter(s => s.summary)
    .map(s => `- ${s.summary}${s.feiten ? '\n  Feiten: ' + s.feiten.slice(0, 200) : ''}`)
    .join('\n')
    .slice(0, 4000)
  const eigenSessiesContext = eigenSessiesText
    ? `\n\nZIJN EIGEN GESPREKKEN OP ARNOBOT (over zijn eigen leiderschap, niet over zijn team):\n${eigenSessiesText}`
    : ''

  const eenOpEensText = logs
    .slice(0, 20)
    .map(l => `- ${new Date(l.created_at).toLocaleDateString('nl-NL')}: agenda "${l.agenda ?? '-'}", aandachtspunt "${l.aandachtspunt ?? '-'}", actie "${l.actie ?? '-'}" (status: ${l.actie_status ?? 'onbekend'})`)
    .join('\n')

  const spiegelContext = spiegel.onvoldoende
    ? ''
    : `\n\nDE SPIEGEL (teambreed thema-patroon, laatste ${spiegel.periodeDagen} dagen): dominant thema "${spiegel.dominant?.thema}" bij ${spiegel.dominant?.leden} van ${spiegel.totaalLeden} teamleden${spiegel.dominant?.trend ? `, trend: ${spiegel.dominant.trend}` : ''}.`

  const spotlightContext = spotlightRes.data?.analyse_text
    ? `\n\nMEEST RECENTE TEAM SPOTLIGHT-ANALYSE:\n${spotlightRes.data.analyse_text.slice(0, 1500)}`
    : ''

  // RAG-verrijking: echte fragmenten uit de Rockefeller Habits/Scaling Up-videokennisbank
  // (arnobot_video_kennisbank.txt, al doorzoekbaar via blog_chunks) om de diagnose te gronden
  // in de bron, niet alleen op de hardgecodeerde parafrase hieronder te laten leunen. Video-
  // chunks zijn te herkennen aan source die met "Video:" begint (embed-chunks.mjs). Zie
  // docs/TEAM_PLAN.md "Ontwerpkeuze synthese-prompt".
  const pillarQueries = {
    strategy: 'strategie vertalen naar salesteam, onderscheidend vermogen bepalen, one-page strategic plan, prioriteiten stellen',
    people: 'de juiste mensen op de juiste plek, A-players B-players C-players aannemen en ontwikkelen, verkopers coachen',
    execution: 'uitvoeringsritme, dagelijkse en wekelijkse vergaderingen, accountability, bottlenecks bespreken en oplossen',
  }
  const [strategyChunks, peopleChunks, executionChunks] = await Promise.all(
    Object.values(pillarQueries).map(q => getRelevantChunks(q, 8).catch(() => []))
  )
  const bronFragment = (chunks: typeof strategyChunks) =>
    chunks.filter(c => c.source?.startsWith('Video:')).slice(0, 2)
      .map(c => `"${c.content.slice(0, 350)}" (${c.source})`)
      .join('\n')
  const bronContext = `\n\nGEGRONDE FRAGMENTEN UIT DE ROCKEFELLER HABITS-KENNISBANK (gebruik als onderbouwing waar relevant, niet verplicht letterlijk citeren):\nStrategy:\n${bronFragment(strategyChunks) || '(geen relevant fragment gevonden)'}\nPeople:\n${bronFragment(peopleChunks) || '(geen relevant fragment gevonden)'}\nExecution:\n${bronFragment(executionChunks) || '(geen relevant fragment gevonden)'}`

  const deltaContext = prev
    ? `\n\nVORIGE SYNTHESE (ter vergelijking):\nVoortgang: ${prev.voortgang}\nStrategy (${prev.strategy_score}/5): ${prev.strategy_diagnose}\nPeople (${prev.people_score}/5): ${prev.people_diagnose}\nExecution (${prev.execution_score}/5): ${prev.execution_diagnose}`
    : ''

  const callModel = () => anthropic.messages.create({
    model: 'claude-fable-5',
    max_tokens: 3000,
    system: `Je bent Arno Diepeveen, salesstrateeg met 40 jaar ervaring, 30 jaar bedrijven bouwen, 15 jaar scaling up coach en mentor. Direct en ongefilterd. Je schrijft een persoonlijk coachingsdocument voor een sales baas, over zijn functioneren als leidinggevende, niet als verkoper. Geen corporate coachtaal. Geen bullshit. Gebruik het woord "moeten" niet, gebruik alternatieven als "kun je", "wil je", "loont het om". Spreek de gebruiker aan met "je". Schrijf ontwikkelpunten zonder tijdslimiet: geen "vandaag", "morgen", "deze week".

Je scoort drie pijlers, afkomstig uit Scaling Up/Rockefeller Habits (Verne Harnish): Strategy, People, Execution.

STRATEGY: vertaalt de sales baas de bedrijfsstrategie naar een helder, onderscheidend plan voor zijn team? Niet: bedenkt hij de strategie zelf, dat is een CEO-taak. Let op of teamleden hun toegevoegde waarde ten opzichte van de concurrentie kunnen verwoorden, en op signalen van veel verloren deals in de gesprekken en feiten: beide wijzen op een slecht doorvertaalde strategie.

PEOPLE: heeft de sales baas de juiste mensen op de juiste plek, en ontwikkelt hij ze structureel? Heeft hij A-players aangenomen? Zo niet, upgradet hij actief zijn B-players, ziet hij hun blinde vlekken én bouwt hij hun sterke punten uit (sterke kanten verder versterken werkt beter dan alleen zwaktes repareren)? Neemt hij tijdig afscheid van C-players? Een teamlid waarbij één van de drie MSA-pijlers (mindset/systeem/actie) over meerdere metingen structureel niet groeit is een indicatie van een C-player, let op of de sales baas daar wel of niet op acteert.

EXECUTION: doen teamleden ook echt de dingen die ertoe doen, worden plannen tot resultaat gebracht? Strategie komt pas tot uiting als goede mensen ook daadwerkelijk actief zijn, primair gericht op klanten en op het marktdeel waar het team maximale bereikbaarheid en waarde kan laten zien. Niet activiteit in het algemeen, activiteit op de juiste plek.

Score elke pijlar op een schaal van 1 (zwak) tot 5 (sterk).

Return ALLEEN een JSON-object, geen uitleg, geen markdown eromheen:
{
  "voortgang": "1-2 zinnen: is er beweging zichtbaar in zijn leiderschap ten opzichte van de vorige synthese, of stagneert het? Wees eerlijk. Bij een eerste synthese: beschrijf de huidige stand.",
  "strategy_score": <getal 1 t/m 5>,
  "strategy_diagnose": "2-3 zinnen, concreet gebaseerd op wat je ziet in de data",
  "people_score": <getal 1 t/m 5>,
  "people_diagnose": "2-3 zinnen, concreet gebaseerd op wat je ziet in de data",
  "execution_score": <getal 1 t/m 5>,
  "execution_diagnose": "2-3 zinnen, concreet gebaseerd op wat je ziet in de data"
}

Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.

${RULE_ENGLISH_TERMS}

${RULE_NO_CRUDE_LANGUAGE}

${RULE_NEVER_BREAK_CHARACTER}

${RULE_NO_INVENTED_DETAILS}
${RULE_NO_DASH}`,
    messages: [{
      role: 'user',
      content: `Schrijf een Strategy People Execution-synthese voor de sales baas van team "${team.name}", op basis van zijn eigen 1:1's met zijn team en de resultaten/patronen van zijn team.

ZIJN 1:1'S MET TEAMLEDEN (meest recent eerst):\n${eenOpEensText}

LAATSTE COACHINGPROFIEL PER TEAMLID:\n${ledenProfielText || '(nog geen coachingprofielen)'}

RECENTE GESPREKSSAMENVATTINGEN VAN TEAMLEDEN:\n${sessieText || '(geen)'}${eigenSessiesContext}${trendContext}${spiegelContext}${spotlightContext}${deltaContext}${bronContext}`
    }]
  })

  let response
  try {
    response = await callModel()
  } catch (err: any) {
    console.error('[zelfcoaching generate error]', err?.status, err?.message ?? err)
    return NextResponse.json({ error: 'generate_error' }, { status: 500 })
  }

  if (response.stop_reason === 'refusal') {
    console.error('[zelfcoaching refusal]')
    return NextResponse.json({ error: 'generate_error', detail: 'refusal' }, { status: 500 })
  }

  let raw = getText(response.content)
  if (!raw) {
    try {
      response = await callModel()
    } catch (err: any) {
      console.error('[zelfcoaching generate error - retry]', err?.status, err?.message ?? err)
      return NextResponse.json({ error: 'generate_error' }, { status: 500 })
    }
    if (response.stop_reason === 'refusal') {
      console.error('[zelfcoaching refusal - retry]')
      return NextResponse.json({ error: 'generate_error', detail: 'refusal' }, { status: 500 })
    }
    raw = getText(response.content)
  }

  if (!raw) {
    console.error('[zelfcoaching] lege synthese na retry')
    return NextResponse.json({ error: 'generate_error', detail: 'empty_after_retry' }, { status: 500 })
  }

  let parsed: {
    voortgang: string
    strategy_score: number
    strategy_diagnose: string
    people_score: number
    people_diagnose: string
    execution_score: number
    execution_diagnose: string
  }
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch?.[0] ?? raw)
  } catch {
    return NextResponse.json({ error: 'parse_error' }, { status: 500 })
  }

  // Richting berekenen op basis van de vorige score, niet LLM-gissing, zelfde patroon als
  // Mindset/Systeem/Actie in coaching/route.ts.
  const richting = (curr: number, p: number | undefined) => p == null ? 'stabiel' : curr > p ? 'stijgend' : curr < p ? 'dalend' : 'stabiel'

  const payload = {
    ...parsed,
    strategy_richting: richting(parsed.strategy_score, prev?.strategy_score),
    people_richting: richting(parsed.people_score, prev?.people_score),
    execution_richting: richting(parsed.execution_score, prev?.execution_score),
    used_1on1_ids: logs.map(l => l.id),
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await supabase
    .from('arnobot_salesbaas_coaching')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  const saveResult = existing
    ? await supabase.from('arnobot_salesbaas_coaching').update(payload).eq('user_id', userId)
    : await supabase.from('arnobot_salesbaas_coaching').insert({ user_id: userId, ...payload })

  if (saveResult.error) {
    console.error('[zelfcoaching save]', saveResult.error.message)
    return NextResponse.json({ error: 'opslaan_mislukt' }, { status: 500 })
  }

  // Geschiedenis van eerdere synthesen, analoog aan arnobot_coaching_history: insert-only,
  // zodat "Jouw leiderschapsreis" een tijdlijn van mijlpalen kan tonen i.p.v. alleen de laatste
  // stand. Nooit blokkerend voor de hoofdrespons als dit faalt, de actuele synthese is al opgeslagen.
  const { error: historyErr } = await supabase.from('arnobot_salesbaas_coaching_history').insert({
    user_id: userId,
    strategy_score: parsed.strategy_score,
    strategy_diagnose: parsed.strategy_diagnose,
    people_score: parsed.people_score,
    people_diagnose: parsed.people_diagnose,
    execution_score: parsed.execution_score,
    execution_diagnose: parsed.execution_diagnose,
    voortgang: parsed.voortgang,
  })
  if (historyErr) console.error('[zelfcoaching history insert]', historyErr.message)

  const speScore = computeSpeScore(parsed.strategy_score, parsed.people_score, parsed.execution_score)
  return NextResponse.json({ coaching: { ...payload, spe_score: speScore } })
}
