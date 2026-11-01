import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import Anthropic from '@anthropic-ai/sdk'
import { isValidEmail, getEmailTemplate } from '@/lib/email-templates'
import { E2E_TEST_USER_EMAIL, MANUAL_TEST_USER_EMAIL, APP_REVIEWER_EMAIL, FAKE_DEMO_USER_LIKE } from '@/lib/internalTestAccounts'
import { notifyCronFailure } from '@/lib/cron-notify'
import { PERSONA_BESCHRIJVINGEN, rolCategorieVoorRol } from '@/lib/sparringPersonas'
import {
  PATROON_VENSTER_DAGEN, PATROON_SPAR_RUST_DAGEN, patroonMailBeschikbaarVoor, kiesPatroonThema,
  schrijfPatroon, bouwSparUrl, themaLeesbaar,
} from '@/lib/patroonMail'

export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)
const anthropic = new Anthropic()

const PARALLEL = 5

// Maandelijks. Een thema uit De Spiegel dat in de laatste 8 weken in minstens 3 gesprekken terugkwam,
// één zin over wat dat in de gesprekken van deze gebruiker betekent (Sonnet) en een knop die Sparren
// opent met een passend scenario. Geen patroon of geen geldig scenario: geen mail. Zie lib/patroonMail.ts.
// ?dry=1 (met ?userId=...) toont wat er verstuurd zou worden zonder te mailen.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const alleenUser = req.nextUrl.searchParams.get('userId')
  try {
    let q = supabase
      .from('approved_users')
      .select('user_id, email, voornaam')
      .eq('is_active', true)
      .eq('nudge_opt_out', false)
      .not('email', 'is', null)
      .neq('email', E2E_TEST_USER_EMAIL)
      .neq('email', MANUAL_TEST_USER_EMAIL)
      .neq('email', APP_REVIEWER_EMAIL)
      .not('user_id', 'like', FAKE_DEMO_USER_LIKE)
    if (alleenUser) q = q.eq('user_id', alleenUser)
    const { data: usersRaw, error: usersErr } = await q
    if (usersErr) throw new Error(usersErr.message)
    const users = (usersRaw ?? []).filter(u => patroonMailBeschikbaarVoor(u.user_id) && isValidEmail(u.email))

    const nu = new Date()
    const vensterStart = new Date(nu.getTime() - PATROON_VENSTER_DAGEN * 24 * 60 * 60 * 1000).toISOString()
    const sparGrens = new Date(nu.getTime() - PATROON_SPAR_RUST_DAGEN * 24 * 60 * 60 * 1000).toISOString()

    let sent = 0
    const overgeslagen: Record<string, number> = {}
    const voorbeelden: unknown[] = []
    const sla = (reden: string) => { overgeslagen[reden] = (overgeslagen[reden] ?? 0) + 1 }

    async function verwerk(user: { user_id: string; email: string; voornaam: string | null }) {
      const [sessiesRes, sparRes, profielRes, analyseRes] = await Promise.all([
        supabase.from('arnobot_blog_sessions').select('title, themas, created_at, summary')
          .eq('user_id', user.user_id).is('deleted_at', null).eq('community_excluded', false)
          .gte('created_at', vensterStart).order('created_at', { ascending: false }).limit(40),
        supabase.from('arnobot_sparring_sessions').select('id', { count: 'exact', head: true })
          .eq('user_id', user.user_id).gte('created_at', sparGrens),
        supabase.from('arnobot_blog_profiles').select('profiel').eq('user_id', user.user_id).maybeSingle(),
        supabase.from('arnobot_analyses').select('analyse_text, created_at')
          .eq('user_id', user.user_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      const sessies = sessiesRes.data ?? []
      const keuze = kiesPatroonThema(sessies, nu.getTime())
      if (!keuze) return sla('geen_thema')
      if ((sparRes.count ?? 0) > 0) return sla('recent_gespard')

      const profiel = (profielRes.data?.profiel ?? {}) as Record<string, unknown>
      const rolCategorie = rolCategorieVoorRol(profiel.rol)
      const personaLijst = Object.keys(PERSONA_BESCHRIJVINGEN[rolCategorie] ?? {}).join(', ')
      const naam = user.voornaam || 'hey'

      const uitvoer = await schrijfPatroon(anthropic, {
        voornaam: naam, rol: profiel.rol, rolCategorie, personaLijst, thema: keuze.thema,
        sessies: sessies.filter(s => s.themas?.includes(keuze.thema)), laatsteAnalyse: analyseRes.data ?? null, vandaag: nu,
      })
      if (!uitvoer) return sla('geen_patroon_of_ongeldig')

      const template = getEmailTemplate('patroon_samenvatting', naam, false, {
        userId: user.user_id,
        patroon: { zin: uitvoer.zin, thema: themaLeesbaar(keuze.thema), aantal: keuze.aantal, url: bouwSparUrl(uitvoer.persona, uitvoer.weerstand) },
      })
      if (dry) { voorbeelden.push({ userId: user.user_id, thema: keuze.thema, aantal: keuze.aantal, ...uitvoer, subject: template.subject }); return }

      try {
        await resend.emails.send({ from: 'ArnoBot <info@arno.bot>', to: user.email, subject: template.subject, html: template.html })
        sent++
      } catch (e) {
        console.error(`[patroon-samenvatting] e-mail naar ${user.user_id} mislukt:`, e)
        sla('verzenden_mislukt')
      }
    }

    // Per gebruiker één fout mag de rest niet stoppen; in groepjes om Anthropic en Supabase niet te bestormen.
    for (let i = 0; i < users.length; i += PARALLEL) {
      const groep = users.slice(i, i + PARALLEL)
      const resultaten = await Promise.allSettled(groep.map(verwerk))
      resultaten.forEach((r, idx) => {
        if (r.status === 'rejected') {
          console.error(`[patroon-samenvatting] ${groep[idx].user_id} mislukt:`, r.reason)
          sla('fout')
        }
      })
    }

    return NextResponse.json({ ok: true, kandidaten: users.length, sent, overgeslagen, ...(dry ? { dry: true, voorbeelden } : {}) })
  } catch (err) {
    await notifyCronFailure('patroon-samenvatting', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
