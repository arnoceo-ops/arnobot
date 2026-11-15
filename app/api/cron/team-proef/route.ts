import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { nieuwMelden } from '@/lib/capaciteit'
import { registreerCronRun } from '@/lib/cronRun'
import { excludeInternalTestUsers, TEST_TEAM_IDS_IN } from '@/lib/internalTestAccounts'
import { logAdminActie } from '@/lib/adminLog'
import { isAgentProef, proefEinde, proefStand, toegangTot, PROEF_COULANCE_DAGEN } from '@/lib/teamProef'
import { verstuurTeamMail } from '@/lib/billing/teamMails'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Dagelijks 07:50 UTC. Beëindigt de gratis proef van 30 dagen van een manager die via de link van een
// sales agent binnenkwam (docs/SALES_DEVELOPMENT.md), en waarschuwt Arno 5 dagen van tevoren. Na de 30 dagen volgt een
// coulance van 10 dagen: de manager krijgt een mail dat hij kan activeren en het team houdt toegang. Pas op dag 40 blokkeert het.
//
// Waarom een eigen cron: zo'n manager heeft command_manager = true, en de toegangspoort (proxy.ts) laat
// hem dan binnen zolang zijn team niet geblokkeerd is. trial-emails slaat managers en teamleden over.
// Zonder deze cron eindigt de proef dus nooit.
//
// Wat telt als proef (lib/teamProef.ts, isAgentProef): de manager kwam via een agent-link (niet handmatig
// toegewezen), betaalt niet zelf en het team heeft nog geen facturatie (min. seats leeg). Een team via
// het aanvraagformulier of met facturatie valt erbuiten en wordt nooit door deze cron aangeraakt.
// Een manager die zelf betaalt wordt ook nooit automatisch geblokkeerd, maar levert wel een melding
// aan Arno op als zijn team geen facturatie heeft (het team loopt dan gratis mee).
//  - Met een team: het team wordt geblokkeerd (manager en leden verliezen de toegang die alleen via het
//    team loopt; wat ze zelf betaald hebben blijft). Dat is hetzelfde blokkeren als op de adminpagina.
//  - Zonder team: command_manager gaat uit, daarna gelden de gewone 30 dagen van een proef.
// Handmatig verlengen kan altijd: VERLENG PROEF op /bot/admin/teams zet de einddatum van de manager
// later en heft de blokkade op. Een gezette einddatum gaat voor op de 30 dagen.
async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const nu = new Date()
    const { data: managers, error } = await excludeInternalTestUsers(
      supabase
        .from('approved_users')
        .select('user_id, email, voornaam, trial_start, expires_at, paid_at, sd_attribution_method')
        .eq('sd_attribution_method', 'link')
        .eq('command_manager', true),
    )
    if (error) throw new Error(error.message)

    const managerIds = (managers ?? []).map(m => m.user_id as string)
    const { data: teams } = managerIds.length
      ? await supabase.from('arnobot_teams').select('id, name, manager_id, min_seats, geblokkeerd_at').in('manager_id', managerIds).not('id', 'in', TEST_TEAM_IDS_IN)
      : { data: [] as { id: string; name: string; manager_id: string; min_seats: number | null; geblokkeerd_at: string | null }[] }
    const teamPerManager = new Map((teams ?? []).map(t => [t.manager_id, t]))

    const berichten: string[] = []
    const beeindigd: string[] = []
    const gewaarschuwd: string[] = []
    const coulance: string[] = []

    for (const m of managers ?? []) {
      const team = teamPerManager.get(m.user_id as string)

      // Een manager die zelf betaalt wordt nooit automatisch geblokkeerd: dat kan een klant zijn (ook via de oude
      // handmatige weg, waar paid_at het teken van een betaald Team is). Maar zijn team heeft dan misschien geen
      // facturatie en loopt gratis mee. Daarom alleen een melding aan Arno, die beslist.
      if (m.paid_at && team && team.min_seats === null) {
        // Bij een betalende manager is expires_at het einde van de betaalperiode, niet van de proef: alleen de 30 dagen tellen.
        const eindeBetaald = proefEinde({ ...m, paid_at: null, expires_at: null })
        if (eindeBetaald && proefStand(eindeBetaald, nu).staat === 'verlopen' && (await nieuwMelden(`teamproef:betaald:${m.user_id}`, 'waarschuwing'))) {
          berichten.push(`Controle nodig: ${m.voornaam ?? 'onbekend'} (${m.email ?? 'geen e-mail'}) betaalt zelf, maar team "${team.name}" heeft geen facturatie ingesteld en de agent-proef is voorbij. Het team loopt gratis mee. Stel de facturatie in bij Teams, of blokkeer het team.`)
        }
        continue
      }
      if (!isAgentProef(m, team?.min_seats ?? null)) continue
      const einde = proefEinde(m)
      if (!einde) continue
      const stand = proefStand(einde, nu)
      const wie = `${m.voornaam ?? 'onbekend'} (${m.email ?? 'geen e-mail'})`

      if (stand.staat === 'coulance') {
        // Dag 30 tot 40: het team houdt toegang. Eenmalig per proef (per einddatum) krijgt de manager een mail dat hij kan activeren.
        if (team && !team.geblokkeerd_at && (await nieuwMelden(`teamproef:coulance:${m.user_id}:${einde.toISOString().slice(0, 10)}`, 'mijlpaal'))) {
          const tot = toegangTot(einde)
          const verstuurd = await verstuurTeamMail(m.user_id as string, 'team_proef_coulance', { teamNaam: team.name, bedragCent: 0, seats: 0, einde: tot.toISOString() })
          berichten.push(`Agent-proef van ${wie} is afgelopen (team "${team.name}"). ${verstuurd ? 'De manager heeft een mail gekregen.' : 'De mail aan de manager is NIET verstuurd, neem zelf contact op.'} Het team houdt toegang tot ${tot.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' })}.`)
          coulance.push(m.user_id as string)
        }
      } else if (stand.staat === 'verlopen') {
        if (team) {
          if (team.geblokkeerd_at) continue // al beëindigd
          const { error: fout } = await supabase.from('arnobot_teams').update({ geblokkeerd_at: nu.toISOString() }).eq('id', team.id)
          if (fout) throw new Error(`team blokkeren mislukt: ${fout.message}`)
          await logAdminActie({ actie: 'team_proef_beeindigd', doelUserId: m.user_id, doelTeamId: team.id, details: { extra: { proef_einde: einde.toISOString().slice(0, 10), actie: 'team geblokkeerd' } } })
          berichten.push(`Agent-proef afgelopen: team "${team.name}" van ${wie} is geblokkeerd, na ${PROEF_COULANCE_DAGEN} dagen coulance. Verlengen kan met VERLENG PROEF bij Teams in de admin.`)
        } else {
          const { error: fout } = await supabase.from('approved_users').update({ command_manager: false }).eq('user_id', m.user_id)
          if (fout) throw new Error(`command_manager intrekken mislukt: ${fout.message}`)
          await logAdminActie({ actie: 'team_proef_beeindigd', doelUserId: m.user_id, details: { extra: { proef_einde: einde.toISOString().slice(0, 10), actie: 'geen team gemaakt, command_manager ingetrokken' } } })
          berichten.push(`Agent-proef afgelopen: ${wie} had geen team gemaakt. De teammanager-toegang is ingetrokken.`)
        }
        beeindigd.push(m.user_id as string)
      } else if (stand.staat === 'bijna' && (await nieuwMelden(`teamproef:bijna:${m.user_id}`, 'waarschuwing'))) {
        berichten.push(`Agent-proef van ${wie} loopt over ${stand.dagen} dag${stand.dagen === 1 ? '' : 'en'} af${team ? ` (team "${team.name}")` : ' (nog geen team gemaakt)'}. Tijd voor het gesprek over een betaald Team.`)
        gewaarschuwd.push(m.user_id as string)
      }
    }

    if (berichten.length > 0) await notifyTelegram(`Teamproef op arno.bot\n\n${berichten.join('\n\n')}`)
    return NextResponse.json({ ok: true, beeindigd, gewaarschuwd, coulance })
  } catch (err) {
    await notifyCronFailure('team-proef', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/team-proef', cronHandler)
