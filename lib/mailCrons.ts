import type { EmailType } from '@/lib/email-templates'
import { leesCrons } from '@/lib/cronOverzicht'

/**
 * Welke cron verstuurt welk mailsjabloon? Voor het CRON-label op de mailpagina in de admin.
 * Een mail die hier niet staat, gaat alleen weg na een gebeurtenis of met de hand.
 * `ookDirect`: dezelfde mail gaat ook weg zonder cron, direct na een actie.
 */
export const MAIL_CRONS: Partial<Record<EmailType, { cron: string; ookDirect?: true }>> = {
  profiel_dag1: { cron: 'trial-emails' },
  profiel_dag4: { cron: 'trial-emails' },
  profiel_dag7: { cron: 'inactivity-nudge' },
  dag1: { cron: 'trial-emails' },
  dag4: { cron: 'trial-emails' },
  geen_gesprek_nudge: { cron: 'inactivity-nudge' },
  first_conversation: { cron: 'trial-emails' },
  dag14: { cron: 'trial-emails' },
  first_coaching: { cron: 'trial-emails' },
  dag21_gesprek: { cron: 'trial-emails' },
  dag25: { cron: 'trial-emails' },
  trial_afgelopen: { cron: 'trial-emails' },
  winback: { cron: 'trial-emails' },
  referral_aanmelding: { cron: 'trial-emails' },
  weekly_nudge: { cron: 'inactivity-nudge' },
  inactivity_dag21: { cron: 'inactivity-nudge' },
  inactivity_dag45: { cron: 'inactivity-nudge' },
  inactivity_dag60: { cron: 'inactivity-nudge' },
  bieb_bijgewerkt: { cron: 'auto-analyse' },
  uitdaging_herinnering: { cron: 'uitdaging-herinnering' },
  patroon_samenvatting: { cron: 'patroon-samenvatting' },
  team_1on1_ritme_nudge: { cron: 'team-1on1-ritme' },
  team_1on1_ritme_herinnering: { cron: 'team-1on1-ritme' },
  verlenging_30d: { cron: 'billing' },
  verlenging_7d: { cron: 'billing' },
  abonnement_afgelopen: { cron: 'billing' },
  testtoegang_reminder: { cron: 'comp-reminder-nov' },
  team_factuur: { cron: 'team-facturatie', ookDirect: true },
  team_factuur_herinnering: { cron: 'team-facturatie' },
  team_geblokkeerd: { cron: 'team-facturatie' },
  team_proef_coulance: { cron: 'team-proef' },
  blog_nieuwe_post: { cron: 'blog', ookDirect: true },
}

/** Tekst achter het CRON-label, met de planning uit vercel.json. null: geen cron. */
export function mailCronTekst(type: string): string | null {
  const m = MAIL_CRONS[type as EmailType]
  if (!m) return null
  const regel = leesCrons().find(c => c.pad === `/api/cron/${m.cron}`)
  return `${m.cron}, ${regel?.schemaTekst ?? 'niet in vercel.json'}${m.ookDirect ? '. Gaat ook direct na een actie.' : ''}`
}
