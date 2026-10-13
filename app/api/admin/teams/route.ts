import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { maakKlant } from '@/lib/billing/mollie'

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
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.teamId) return NextResponse.json({ error: 'Geen teamId' }, { status: 400 })

  const { teamId, minSeats, cyclus, volgendeFactuurdatum, geblokkeerdAt, bedrijfsnaam, kvkNummer, btwNummer, straat, postcode, plaats } = body

  if (cyclus !== undefined && cyclus !== null && cyclus !== 'maandelijks' && cyclus !== 'jaarlijks') {
    return NextResponse.json({ error: 'Ongeldige cyclus' }, { status: 400 })
  }
  if (minSeats !== undefined && minSeats !== null && (!Number.isFinite(Number(minSeats)) || Number(minSeats) < 1)) {
    return NextResponse.json({ error: 'Ongeldig aantal seats' }, { status: 400 })
  }

  const teamUpdate: Record<string, unknown> = {}
  if (minSeats !== undefined) teamUpdate.min_seats = minSeats === null ? null : Number(minSeats)
  if (cyclus !== undefined) teamUpdate.cyclus = cyclus
  if (volgendeFactuurdatum !== undefined) teamUpdate.volgende_factuurdatum = volgendeFactuurdatum
  if (geblokkeerdAt !== undefined) teamUpdate.geblokkeerd_at = geblokkeerdAt

  if (Object.keys(teamUpdate).length) {
    const { error } = await supabase.from('arnobot_teams').update(teamUpdate).eq('id', teamId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (bedrijfsnaam !== undefined) {
    if (!bedrijfsnaam?.trim()) return NextResponse.json({ error: 'Bedrijfsnaam is verplicht' }, { status: 400 })
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
  }

  return NextResponse.json({ ok: true })
}
