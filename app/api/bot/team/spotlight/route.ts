export const maxDuration = 30

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { RULE_ENGLISH_TERMS, RULE_NO_CRUDE_LANGUAGE, RULE_NEVER_BREAK_CHARACTER, RULE_NO_INVENTED_DETAILS } from '@/lib/systemPrompt'
import { computeThemaMaandTrend, computeSpiegelSignaal } from '@/lib/spiegel'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ analyses: [] })

  const { data: analyses } = await supabase
    .from('arnobot_team_analyses')
    .select('id, analyse_text, created_at')
    .eq('team_id', managerMember.team_id)
    .order('created_at', { ascending: false })
    .limit(5)

  return NextResponse.json({ analyses: analyses ?? [] })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id, arnobot_teams(name)')
    .eq('user_id', userId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ error: 'Geen manager-toegang' }, { status: 403 })

  const team = managerMember.arnobot_teams as unknown as { name: string }

  // Blokkeer als er al een analyse is van minder dan 7 dagen oud
  const { data: recent } = await supabase
    .from('arnobot_team_analyses')
    .select('created_at')
    .eq('team_id', managerMember.team_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recent) {
    const dagenOud = (Date.now() - new Date(recent.created_at).getTime()) / 86400000
    if (dagenOud < 7) {
      const dagenRest = Math.ceil(7 - dagenOud)
      return NextResponse.json(
        { error: `Er is al een analyse van deze week. Probeer het over ${dagenRest} ${dagenRest === 1 ? 'dag' : 'dagen'} opnieuw.` },
        { status: 429 }
      )
    }
  }

  const { data: members } = await supabase
    .from('arnobot_team_members')
    .select('user_id')
    .eq('team_id', managerMember.team_id)

  if (!members?.length) return NextResponse.json({ error: 'Geen teamleden' }, { status: 400 })

  const memberIds = members.map(m => m.user_id)

  const [sessionsRes, scoresRes] = await Promise.all([
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
  ])

  if (!sessionsRes.data?.length) return NextResponse.json({ error: 'Niet genoeg data voor een team-analyse' }, { status: 400 })

  const teamData = sessionsRes.data
    .filter(s => s.summary)
    .map(s => `- ${s.summary}${s.feiten ? '\n  Feiten: ' + s.feiten.slice(0, 200) : ''}`)
    .join('\n\n')
    .slice(0, 6000)

  // Bereken maandgemiddelden uit historische scores
  const byMonth: Record<string, { mindset: number[]; systeem: number[]; actie: number[] }> = {}
  for (const s of scoresRes.data ?? []) {
    const month = s.created_at.slice(0, 7)
    if (!byMonth[month]) byMonth[month] = { mindset: [], systeem: [], actie: [] }
    if (s.mindset_score) byMonth[month].mindset.push(s.mindset_score)
    if (s.systeem_score) byMonth[month].systeem.push(s.systeem_score)
    if (s.actie_score) byMonth[month].actie.push(s.actie_score)
  }
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null
  const maanden = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  const trendRegels = Object.entries(byMonth)
    .slice(-6)
    .map(([month, d]) => {
      const m = avg(d.mindset), s = avg(d.systeem), a = avg(d.actie)
      const label = `${maanden[parseInt(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
      return `${label}: Mindset ${m ?? '?'} / Systeem ${s ?? '?'} / Actie ${a ?? '?'}`
    })
    .join('\n')

  const trendContext = trendRegels ? `\n\nTEAMSCORES OVER TIJD (gemiddeld per maand):\n${trendRegels}` : ''

  // Punt 2B "De Tijdlijn": maandelijkse thema-geschiedenis als extra duidingscontext, geen
  // los weergaveblok. Zie docs/TEAM_PLAN.md voor de volledige afweging.
  const themaTrend = await computeThemaMaandTrend(memberIds)
  const themaTrendContext = themaTrend ? `\n\nDOMINANT GESPREKSTHEMA PER MAAND:\n${themaTrend}` : ''

  // Punt 2A "De Spiegel": had eerst een eigen UI-kaart, weggehaald na feedback ("ik zie maar
  // één woord, wat moet ik daarmee") — precies hetzelfde probleem als 2B. Signaal blijft
  // bestaan, alleen nu als context voor deze synthese, niet als los rauw weergaveblok.
  const spiegel = await computeSpiegelSignaal(memberIds)
  const spiegelContext = !spiegel.onvoldoende && spiegel.dominant
    ? `\n\nHUIDIG SIGNAAL (laatste ${spiegel.periodeDagen} dagen): dominant thema "${spiegel.dominant.thema}" bij ${spiegel.dominant.leden} van ${spiegel.totaalLeden} teamleden${spiegel.dominant.trend ? `, trend: ${spiegel.dominant.trend}` : ''}.`
    : ''

  const callModel = () => anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 700,
    system: `Je bent Arno Diepeveen, salescoach met 40 jaar ervaring. Direct, eerlijk, maar altijd gericht op groei.
Je schrijft een teamanalyse voor de manager. Toon: motiverend én scherp. Geen lofzang, geen afbranden.
Begin DIRECT met de eerste sectiekop. Geen documenttitel, geen teamnaam, geen inleiding bovenaan.
Structuur (gebruik deze vaste opbouw, zonder markdown headers):

PER PIJLER
Drie korte regels, één per pijler, op basis van de scoreontwikkeling en wat daarover blijkt uit de gesprekken. Niet herhalen wat je in KRACHT VAN HET TEAM of GROEIKANS al gaat zeggen, dit is de korte stand van zaken per pijler waar de rest op voortbouwt.
Mindset: [collectieve stand, één zin]
Systeem: [collectieve stand, één zin]
Actie: [collectieve stand, één zin]

KRACHT VAN HET TEAM
Wat doet dit team collectief goed? Waar zit echte potentie? Wees specifiek.

GROEIKANS
Één patroon dat het team collectief terughoudt. Benoem het helder, zonder te veroordelen.

Als er een DOMINANT GESPREKSTHEMA PER MAAND-lijst is meegegeven: duid die beweging expliciet ergens in KRACHT VAN HET TEAM of GROEIKANS. Blijft hetzelfde thema meerdere maanden dominant, benoem dan of dat wijst op verdieping (positief) of op vastzitten (aandachtspunt), op basis van de rest van de data. Verschuift het thema van maand tot maand, benoem dan of dat een natuurlijke voortgang is (bijv. van prospecting naar bezwaarhantering naar closing past bij een groep die door de pijplijn beweegt) of een teken van afleiding. Nooit alleen de thema's opsommen zonder duiding, dat heeft de manager al gezien.

ARNO'S ADVIES
Één concrete actie die de manager kan inzetten. Praktisch, uitvoerbaar, direct.

Maximaal 300 woorden totaal (was 250, de nieuwe PER PIJLER-sectie heeft iets meer ruimte nodig). Schrijf in eerste persoon, alsof je de manager persoonlijk aanspreekt.
Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst.
Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.
Gebruik geen accenten om woorden te benadrukken (geen écht, dát, zó, dít, én).
Gebruik het woord "moeten" niet; gebruik alternatieven als "kun je", "wil je", "loont het om".

${RULE_ENGLISH_TERMS}

${RULE_NO_CRUDE_LANGUAGE}

${RULE_NEVER_BREAK_CHARACTER}

${RULE_NO_INVENTED_DETAILS}`,
    messages: [{
      role: 'user',
      content: `Schrijf een teamanalyse voor de manager van team "${team.name}" op basis van de gesprekssamenvatingen en scoreontwikkeling van zijn teamleden.

GESPREKKEN:
${teamData}${trendContext}${themaTrendContext}${spiegelContext}`
    }]
  })

  let analyse = getText(await callModel().then(r => r.content))
  if (!analyse) {
    analyse = getText(await callModel().then(r => r.content))
  }
  if (!analyse) {
    console.error('[bot/team/spotlight] lege analyse na retry, team_id:', managerMember.team_id)
    return NextResponse.json({ error: 'genereren_mislukt' }, { status: 500 })
  }

  await supabase
    .from('arnobot_team_analyses')
    .insert({ team_id: managerMember.team_id, analyse_text: analyse })

  // Houd maximaal 5 analyses per team — verwijder de oudste
  const { data: all } = await supabase
    .from('arnobot_team_analyses')
    .select('id')
    .eq('team_id', managerMember.team_id)
    .order('created_at', { ascending: false })

  if (all && all.length > 5) {
    const toDelete = all.slice(5).map(r => r.id)
    await supabase.from('arnobot_team_analyses').delete().in('id', toDelete)
  }

  return NextResponse.json({ analyse })
}
