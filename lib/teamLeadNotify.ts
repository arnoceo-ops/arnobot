import { clerkClient } from '@clerk/nextjs/server'
import { Resend } from 'resend'
import { SupabaseClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

// Lead-signaal: iemand die via een gewone trial binnenkomt en bij de intake aangeeft ArnoBot
// voor zijn team te willen (geen bestaand Team-account, want dan is command_manager gezet en
// verschijnt deze vraag niet). Eenmalig, één mail naar de inbox, geen tabel of CRM (zie
// docs/SALES_BIJBEL.md "Aanlooproutes"). team_lead_notified voorkomt een dubbele mail: de
// vroege trigger (app/api/bot/team-lead-signal/route.ts, direct bij "voor mijn team" +
// teamgrootte, zodat een afhaker vóór het einde van het formulier niet gemist wordt) is de
// hoofdroute; de check in app/api/bot/profiel/route.ts (bij afronding van de hele intake) is
// een vangnet voor als die vroege call om wat voor reden dan ook niet aankwam.
export async function notifyTeamLead(
  serviceDb: SupabaseClient,
  userId: string,
  rol: string,
  teamgrootte: string,
): Promise<void> {
  const { data: huidig } = await serviceDb
    .from('approved_users')
    .select('onboarding_done, team_lead_notified, linkedin')
    .eq('user_id', userId)
    .maybeSingle()

  if (huidig?.onboarding_done || huidig?.team_lead_notified) return

  // Eerst markeren, dan pas versturen: voorkomt een dubbele mail bij twee bijna-gelijktijdige
  // aanroepen (vroege trigger + eind-van-formulier-vangnet binnen dezelfde paar seconden).
  await serviceDb.from('approved_users').update({ team_lead_notified: true }).eq('user_id', userId)

  try {
    const clerk = await clerkClient()
    const user = await clerk.users.getUser(userId)
    const email = user.emailAddresses[0]?.emailAddress ?? 'onbekend'
    const naam = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'onbekend'
    const linkedin = (huidig?.linkedin as string | null) || 'onbekend'
    await resend.emails.send({
      from: 'ArnoBot <info@arno.bot>',
      to: 'waitlist@arno.bot',
      subject: 'Team-lead vanuit de trial-onboarding',
      text: `Iemand gaf bij de profiel-intake aan ArnoBot voor zijn team te willen:\n\nNaam: ${naam}\nE-mail: ${email}\nLinkedIn: ${linkedin}\nRol: ${rol || 'onbekend'}\nTeamgrootte: ${teamgrootte || 'onbekend'}`,
    })
  } catch (e) {
    console.error('team-lead mail:', e)
  }
}
