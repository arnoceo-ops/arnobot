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
 * Het kenmerk gratis account (lib/gratisAccount.ts). Een eigen schrijfactie die nooit gooit: een betaling, herstart of
 * adminknop mag er niet op mislukken. Geeft false als het niet is gelukt (vangnet: lib/billing/gratisHerstel.ts). Aan
 * bewaart de eerste datum. Bij uitzetten komt eerst een regel in het adminlog, zodat zichtbaar blijft dat het account
 * gratis is geweest.
 */
export async function zetGratisKenmerk(db: SupabaseClient, userId: string, aan: boolean): Promise<boolean> {
  try {
    if (aan) {
      const { error } = await db.from('approved_users').update({ gratis_sinds: new Date().toISOString() }).eq('user_id', userId).is('gratis_sinds', null)
      if (error && !kolomOntbreekt(error)) throw new Error(error.message)
      return true
    }
    const { data, error: leesFout } = await db.from('approved_users').select('gratis_sinds').eq('user_id', userId).maybeSingle()
    if (leesFout) {
      if (kolomOntbreekt(leesFout)) return true
      throw new Error(leesFout.message)
    }
    const sinds = (data as { gratis_sinds?: string | null } | null)?.gratis_sinds
    if (!sinds) return true
    const { error: logFout } = await db.from('arnobot_admin_log').insert({
      actie: 'gratis_beeindigd', doel_user_id: userId, doel_team_id: null, details: { oud: { gratis_sinds: sinds } },
    })
    if (logFout) throw new Error(logFout.message)
    const { error } = await db.from('approved_users').update({ gratis_sinds: null }).eq('user_id', userId)
    if (error) throw new Error(error.message)
    return true
  } catch (e) {
    Sentry.captureException(e, { level: 'error', tags: { onderdeel: 'referral-kenmerk' }, extra: { userId, kolom: 'gratis_sinds', aan } })
    return false
  }
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
