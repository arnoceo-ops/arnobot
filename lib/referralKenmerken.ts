import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

// Twee gegevens die de referralregels nodig hebben en die anders verloren gaan (docs/sql/2026-11-26-referral-ronde2.sql):
// de start van de eerste echte proef (trial_start wordt bij een herstart en bij gratis toegang overschreven) en of
// iemand ooit gewoon teamlid is geweest (de rij verdwijnt bij het verwijderen uit een team).
// Altijd een eigen schrijfactie: zolang de kolommen ontbreken mag intake, herstart of uitnodiging niet mislukken.

const kolomOntbreekt = (fout: { message: string }) => /column .+ does not exist|Could not find the '.+' column/i.test(fout.message)

async function zetEenmalig(db: SupabaseClient, userId: string, kolom: 'eerste_proef_start' | 'ooit_teamlid_at', waarde: string): Promise<void> {
  try {
    const { error } = await db.from('approved_users').update({ [kolom]: waarde }).eq('user_id', userId).is(kolom, null)
    if (error && !kolomOntbreekt(error)) throw new Error(error.message)
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'referral-kenmerk' }, extra: { userId, kolom } })
  }
}

/** Alleen aanroepen met de start van de eerste proef, dus nooit na een herstart. */
export async function bewaarEersteProefStart(db: SupabaseClient, userId: string, start: string | null | undefined): Promise<void> {
  if (start) await zetEenmalig(db, userId, 'eerste_proef_start', start)
}

export async function bewaarOoitTeamlid(db: SupabaseClient, userId: string): Promise<void> {
  await zetEenmalig(db, userId, 'ooit_teamlid_at', new Date().toISOString())
}

/**
 * De start van de eerste echte proef (besluit Arno 26-11-2026): de bewaarde datum, anders trial_start zolang er nooit is
 * herstart, anders de meegegeven terugvaldatum (bij een aangebrachte klant de aanmelding).
 */
export function eersteProefStart(
  g: { eerste_proef_start?: string | null; trial_start?: string | null; trial_reactivated_at?: string | null } | null | undefined,
  terugval: string | null,
): string | null {
  if (g?.eerste_proef_start) return g.eerste_proef_start
  if (g && !g.trial_reactivated_at && g.trial_start) return g.trial_start
  return terugval
}
