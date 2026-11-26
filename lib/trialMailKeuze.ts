import type { EmailType } from '@/lib/email-templates'

export interface TrialMailStand {
  /** Hele dagen sinds trial_start. Die wordt opnieuw gezet als het profiel voor het eerst af is. */
  dagen: number
  profielAf: boolean
  /** Aantal berichten in de hoofdchat (arnobot_rds_logs). */
  gesprekken: number
  sessies: number
  coachingRapporten: number
  gesprekMetArnoGeboekt: boolean
  verzonden: ReadonlySet<string>
}

/**
 * Welke proefmail krijgt deze gebruiker vandaag? Hooguit één per run.
 *
 * Zonder profiel gaan de eerste mails over het afmaken daarvan. Die hebben eigen logtypes, zodat de
 * gewone dag 1 en dag 4 na het afronden alsnog kunnen. Wie de gewone variant al kreeg, krijgt de
 * profielvariant van dezelfde dag niet meer.
 */
export function kiesTrialMail(s: TrialMailStand): EmailType | null {
  const heeft = (type: EmailType) => s.verzonden.has(type)

  if (!s.profielAf) {
    if (s.dagen >= 1 && !heeft('profiel_dag1') && !heeft('dag1')) return 'profiel_dag1'
    if (s.dagen >= 4 && !heeft('profiel_dag4') && !heeft('dag4')) return 'profiel_dag4'
  } else {
    if (s.dagen >= 1 && s.gesprekken === 0 && !heeft('dag1')) return 'dag1'
    if (s.dagen >= 1 && s.gesprekken >= 1 && !heeft('first_conversation')) return 'first_conversation'
    if (s.dagen >= 4 && s.gesprekken === 0 && !heeft('dag4')) return 'dag4'
    if (s.sessies >= 5 && s.coachingRapporten === 0 && !heeft('first_coaching')) return 'first_coaching'
  }

  // "Twee weken ArnoBot" klopt alleen voor wie echt begonnen is.
  if (s.dagen >= 14 && s.gesprekken >= 1 && !heeft('dag14')) return 'dag14'
  if (s.dagen >= 21 && !heeft('dag21_gesprek') && !s.gesprekMetArnoGeboekt) return 'dag21_gesprek'
  if (s.dagen >= 25 && !heeft('dag25')) return 'dag25'
  return null
}
