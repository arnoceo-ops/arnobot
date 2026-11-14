import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { maakKlant } from '@/lib/billing/mollie'
import { adminKeyMatches } from '@/lib/adminAuth'
import { logAdminActie } from '@/lib/adminLog'
import { isAgentProef } from '@/lib/teamProef'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Zet de Team-betaalprotocol-velden (fase 2b) voor een team, plus optioneel de
// bedrijfsgegevens van de teambaas voor de Moneybird-factuur. Enige plek waar dit gebeurt,
// i.p.v. rechtstreeks in Supabase: voorkomt typefouten in productie-facturatiedata.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!adminKeyMatches(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.teamId) return NextResponse.json({ error: 'Geen teamId' }, { status: 400 })

  // Gratis agent-proef verlengen (docs/TEAM_ONBOARDING.md): zet de einddatum van de manager later en heft
  // de blokkade op die het einde van de proef zette. Alleen voor een team dat echt een agent-proef heeft.
  if (body.verlengProefTot !== undefined) {
    const einde = new Date(body.verlengProefTot)
    const nu = Date.now()
    if (isNaN(einde.getTime()) || einde.getTime() <= nu || einde.getTime() > nu + 366 * 86_400_000) {
      return NextResponse.json({ error: 'Kies een einddatum in de toekomst, hooguit een jaar vooruit' }, { status: 400 })
    }
    const { data: team } = await supabase.from('arnobot_teams').select('id, manager_id, min_seats, geblokkeerd_at').eq('id', body.teamId).maybeSingle()
    if (!team) return NextResponse.json({ error: 'Team niet gevonden' }, { status: 404 })
    const { data: manager } = await supabase
      .from('approved_users')
      .select('trial_start, expires_at, paid_at, sd_attribution_method')
      .eq('user_id', team.manager_id)
      .maybeSingle()
    if (!manager || !isAgentProef(manager, team.min_seats)) {
      return NextResponse.json({ error: 'Dit team heeft geen agent-proef (geen agent-link, al betaald of facturatie ingesteld)' }, { status: 400 })
    }
    const { error: managerFout } = await supabase.from('approved_users').update({ expires_at: einde.toISOString() }).eq('user_id', team.manager_id)
    if (managerFout) return NextResponse.json({ error: managerFout.message }, { status: 500 })
    if (team.geblokkeerd_at) {
      const { error: teamFout } = await supabase.from('arnobot_teams').update({ geblokkeerd_at: null }).eq('id', team.id)
      if (teamFout) return NextResponse.json({ error: teamFout.message }, { status: 500 })
    }
    await logAdminActie({
      actie: 'team_proef_verlengd', doelUserId: team.manager_id, doelTeamId: String(team.id),
      details: { oud: { expires_at: manager.expires_at, geblokkeerd_at: team.geblokkeerd_at }, nieuw: { expires_at: einde.toISOString(), geblokkeerd_at: null } },
    })
    return NextResponse.json({ ok: true })
  }

  const { teamId, minSeats, cyclus, volgendeFactuurdatum, geblokkeerdAt, bedrijfsnaam, kvkNummer, btwNummer, straat, postcode, plaats } = body

  if (cyclus !== undefined && cyclus !== null && cyclus !== 'maandelijks' && cyclus !== 'jaarlijks') {
    return NextResponse.json({ error: 'Ongeldige cyclus' }, { status: 400 })
  }
  if (minSeats !== undefined && minSeats !== null && (!Number.isFinite(Number(minSeats)) || Number(minSeats) < 1)) {
    return NextResponse.json({ error: 'Ongeldig aantal seats' }, { status: 400 })
  }

  // Alles valideren vóór er iets wordt opgeslagen: eerder sloeg de route de teaminstellingen op
  // en gaf daarna "Bedrijfsnaam is verplicht", waardoor de UI "Mislukt" toonde terwijl het al
  // (deels) was doorgevoerd.
  if (bedrijfsnaam !== undefined && !bedrijfsnaam?.trim()) {
    return NextResponse.json({ error: 'Bedrijfsnaam is verplicht' }, { status: 400 })
  }

  const teamUpdate: Record<string, unknown> = {}
  if (minSeats !== undefined) teamUpdate.min_seats = minSeats === null ? null : Number(minSeats)
  if (cyclus !== undefined) teamUpdate.cyclus = cyclus
  if (volgendeFactuurdatum !== undefined) teamUpdate.volgende_factuurdatum = volgendeFactuurdatum
  if (geblokkeerdAt !== undefined) teamUpdate.geblokkeerd_at = geblokkeerdAt

  if (Object.keys(teamUpdate).length) {
    const { data: oudTeam } = await supabase
      .from('arnobot_teams')
      .select('min_seats, cyclus, volgende_factuurdatum, geblokkeerd_at')
      .eq('id', teamId)
      .maybeSingle<Record<string, unknown>>()
    const { error } = await supabase.from('arnobot_teams').update(teamUpdate).eq('id', teamId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const oud: Record<string, unknown> = {}
    for (const k of Object.keys(teamUpdate)) oud[k] = oudTeam?.[k] ?? null
    await logAdminActie({ actie: 'team_instellingen', doelTeamId: String(teamId), details: { oud, nieuw: teamUpdate } })
  }

  if (bedrijfsnaam !== undefined) {
    const { data: team } = await supabase.from('arnobot_teams').select('manager_id').eq('id', teamId).maybeSingle<{ manager_id: string }>()
    if (!team) return NextResponse.json({ error: 'Team niet gevonden' }, { status: 404 })
    const { data: manager } = await supabase.from('approved_users').select('email').eq('user_id', team.manager_id).maybeSingle<{ email: string | null }>()
    const { data: bestaand } = await supabase
      .from('arnobot_billing_customers')
      .select('mollie_customer_id')
      .eq('user_id', team.manager_id)
      .maybeSingle<{ mollie_customer_id: string }>()
    const mollieKlantId = bestaand?.mollie_customer_id
      ?? (manager?.email ? (await maakKlant({ naam: bedrijfsnaam, email: manager.email, userId: team.manager_id })).id : null)
    if (!mollieKlantId) return NextResponse.json({ error: 'Geen e-mailadres bekend voor de teambaas, kan geen Mollie-klant aanmaken' }, { status: 400 })
    const { error } = await supabase.from('arnobot_billing_customers').upsert(
      {
        user_id: team.manager_id,
        mollie_customer_id: mollieKlantId,
        klant_type: 'zakelijk',
        bedrijfsnaam: bedrijfsnaam || null,
        kvk_nummer: kvkNummer || null,
        btw_nummer: btwNummer || null,
        straat: straat || null,
        postcode: postcode || null,
        plaats: plaats || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAdminActie({ actie: 'team_bedrijfsgegevens', doelTeamId: String(teamId), doelUserId: team.manager_id, details: { nieuw: { bedrijfsnaam, kvk_nummer: kvkNummer || null, btw_nummer: btwNummer || null } } })
  }

  return NextResponse.json({ ok: true })
}
