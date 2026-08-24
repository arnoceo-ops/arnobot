import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clerkClient } from '@clerk/nextjs/server'
import { Resend } from 'resend'
import { Redis } from '@upstash/redis'
import { getEmailTemplate, isValidEmail } from '@/lib/email-templates'
import { getLagendeLeden } from '@/lib/team1on1Ritme'
import { TEST_TEAM_ID } from '@/lib/internalTestAccounts'
import { notifyCronFailure } from '@/lib/cron-notify'

// 1:1-cadans-notificatie/escalatieflow (docs/TEAM_PLAN.md): een teamlid zonder 1:1 langer dan
// 2 weken triggert eerst een in-app belletje, dan (als dat 48u ongelezen blijft) mail 1, dan
// (5 dagen na het eerste leessignaal, nog steeds onopgelost) mail 2. Geen nieuwe databasekolommen:
// het belletje hergebruikt het bestaande arnobot_team_notifications (read_at bestond al), de
// mail-1/mail-2-dedup + -tijdstippen staan in Redis (zelfde patroon als de Telegram-dedup bij
// het 2C-signaal in dashboard/route.ts), zodat hier geen Supabase-migratie voor nodig was.
//
// Scope-vereenvoudiging, bewust: er bestaat nergens in deze codebase e-mail-open-tracking (geen
// Resend-webhook). Het "eerste leessignaal" voor de mail-2-timer is daarom het belletje
// (read_at) als dat er is, anders het verzendmoment van mail 1 als beste beschikbare proxy.
// Mail 2 vereist bovendien dat mail 1 al verstuurd is (geen losse triggerpad voor het geval het
// belletje al binnen 48u gelezen werd maar het probleem nadien alsnog aanhoudt) — een bewuste
// vereenvoudiging t.o.v. de letterlijke ontwerptekst, gemeld aan Arno bij het bouwen.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const MAIL1_WACHTTIJD_UUR = 48
const MAIL2_WACHTTIJD_DAGEN = 5
const REDIS_TTL_SECONDEN = 30 * 86400

type Bel = { member_id: string | null; created_at: string; read_at: string | null }

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {

  const { data: managerRows } = await supabase
    .from('arnobot_team_members')
    .select('user_id, team_id')
    .eq('role', 'manager')

  const teamIds = [...new Set((managerRows ?? []).map(r => r.team_id).filter(id => id !== TEST_TEAM_ID))]
  if (teamIds.length === 0) return NextResponse.json({ ok: true, teams: 0 })

  let bellenAangemaakt = 0
  let mail1Verstuurd = 0
  let mail2Verstuurd = 0

  for (const teamId of teamIds) {
    const { data: members } = await supabase
      .from('arnobot_team_members')
      .select('user_id, joined_at')
      .eq('team_id', teamId)
      .neq('role', 'manager')
    if (!members?.length) continue

    const joinedAtMap: Record<string, string> = {}
    for (const m of members) joinedAtMap[m.user_id] = m.joined_at
    const memberIds = members.map(m => m.user_id)

    const managersVoorTeam = (managerRows ?? []).filter(r => r.team_id === teamId)
    const lagend = await getLagendeLeden(teamId, memberIds, joinedAtMap)

    if (lagend.length === 0) {
      // Probleem opgelost (of nooit ontstaan): Redis-state resetten zodat een volgende episode
      // weer met een schone lei begint.
      for (const m of managersVoorTeam) {
        await redis.del(`arnobot:1on1-nudge:mail1:${m.user_id}`)
        await redis.del(`arnobot:1on1-nudge:mail2:${m.user_id}`)
      }
      continue
    }

    const clerk = await clerkClient()
    const alleIds = [...new Set([...lagend.map(l => l.user_id), ...managersVoorTeam.map(m => m.user_id)])]
    const usersResponse = await clerk.users.getUserList({ userId: alleIds, limit: 50 })
    const nameMap: Record<string, string> = {}
    const emailMap: Record<string, string> = {}
    for (const u of usersResponse.data) {
      nameMap[u.id] = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.emailAddresses[0]?.emailAddress || u.id
      emailMap[u.id] = u.emailAddresses[0]?.emailAddress ?? ''
    }

    const referentieMap: Record<string, string> = {}
    for (const l of lagend) referentieMap[l.user_id] = l.referentie

    // Belletje per lagend lid: alleen aanmaken als er nog geen bel bestaat uit de huidige
    // lagende episode (bel.created_at >= referentie). Voorkomt zowel dubbele bellen bij elke
    // dagelijkse run als een nieuwe bel meteen nadat de vorige gelezen is terwijl het probleem
    // nog voortduurt.
    for (const lid of lagend) {
      const { data: laatsteBel } = await supabase
        .from('arnobot_team_notifications')
        .select('created_at')
        .eq('team_id', teamId)
        .eq('type', 'lage_1on1_cadans')
        .eq('member_id', lid.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nieuweEpisode = !laatsteBel || new Date(laatsteBel.created_at) < new Date(lid.referentie)
      if (!nieuweEpisode) continue

      for (const m of managersVoorTeam) {
        await supabase.from('arnobot_team_notifications').insert({
          team_id: teamId,
          manager_id: m.user_id,
          type: 'lage_1on1_cadans',
          member_id: lid.user_id,
          member_name: nameMap[lid.user_id] ?? 'Onbekend',
        })
      }
      bellenAangemaakt++
    }

    const namenLijst = lagend.map(l => nameMap[l.user_id] ?? 'een teamlid')

    for (const m of managersVoorTeam) {
      const managerEmail = emailMap[m.user_id]
      if (!managerEmail || !isValidEmail(managerEmail)) continue
      const managerNaam = nameMap[m.user_id]?.split(' ')[0] || 'hey'

      const { data: bellenManager } = await supabase
        .from('arnobot_team_notifications')
        .select('member_id, created_at, read_at')
        .eq('team_id', teamId)
        .eq('manager_id', m.user_id)
        .eq('type', 'lage_1on1_cadans')
        .in('member_id', lagend.map(l => l.user_id))

      const actieveBellen = ((bellenManager ?? []) as Bel[]).filter(
        b => b.member_id && referentieMap[b.member_id] && new Date(b.created_at) >= new Date(referentieMap[b.member_id])
      )
      if (actieveBellen.length === 0) continue

      const mail1Key = `arnobot:1on1-nudge:mail1:${m.user_id}`
      const mail2Key = `arnobot:1on1-nudge:mail2:${m.user_id}`
      const mail1SentAt = await redis.get<string>(mail1Key)
      const mail2SentAt = await redis.get<string>(mail2Key)

      const oudsteOngelezen = actieveBellen.filter(b => !b.read_at).sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
      const vroegsteGelezen = actieveBellen.filter(b => b.read_at).sort((a, b) => (a.read_at as string).localeCompare(b.read_at as string))[0]

      // Mail 1: 48u na de oudste nog-ongelezen bel uit deze episode, nog niet eerder verstuurd.
      if (!mail1SentAt && oudsteOngelezen) {
        const belLeeftijdUur = (Date.now() - new Date(oudsteOngelezen.created_at).getTime()) / 3600000
        if (belLeeftijdUur >= MAIL1_WACHTTIJD_UUR) {
          const template = getEmailTemplate('team_1on1_ritme_nudge', managerNaam, false, { userId: m.user_id, laggingNames: namenLijst })
          try {
            await resend.emails.send({ from: 'ArnoBot <info@arno.bot>', to: managerEmail, subject: template.subject, html: template.html })
            await redis.set(mail1Key, new Date().toISOString(), { ex: REDIS_TTL_SECONDEN })
            mail1Verstuurd++
          } catch (e) {
            console.error(`1:1-ritme mail 1 naar ${managerEmail} mislukt:`, e)
          }
        }
      }

      // Mail 2: 5 dagen na het eerste leessignaal (bel gelezen, anders mail-1-verzendtijd als
      // proxy). Vereist dat mail 1 al verstuurd is, zie scope-notitie bovenaan dit bestand.
      if (mail1SentAt && !mail2SentAt) {
        const referentieSignaal = vroegsteGelezen?.read_at ?? mail1SentAt
        const dagenSindsSignaal = (Date.now() - new Date(referentieSignaal as string).getTime()) / 86400000
        if (dagenSindsSignaal >= MAIL2_WACHTTIJD_DAGEN) {
          const template = getEmailTemplate('team_1on1_ritme_herinnering', managerNaam, false, { userId: m.user_id, laggingNames: namenLijst })
          try {
            await resend.emails.send({ from: 'ArnoBot <info@arno.bot>', to: managerEmail, subject: template.subject, html: template.html })
            await redis.set(mail2Key, new Date().toISOString(), { ex: REDIS_TTL_SECONDEN })
            mail2Verstuurd++
          } catch (e) {
            console.error(`1:1-ritme mail 2 naar ${managerEmail} mislukt:`, e)
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, teams: teamIds.length, bellenAangemaakt, mail1Verstuurd, mail2Verstuurd })
  } catch (err) {
    await notifyCronFailure('team-1on1-ritme', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
