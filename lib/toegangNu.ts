import { createClient } from '@supabase/supabase-js'
import { datumToegang } from '@/lib/toegang'

// Heeft deze gebruiker op dit moment toegang tot ArnoBot? Dezelfde regels als de toegangspoort (proxy.ts, regels rond
// datumToegang en het team), voor API-routes die zelf geld kosten. De poort bewaakt alleen de pagina's: zonder deze
// controle kan een verlopen of geblokkeerde gebruiker met een zelf samengesteld verzoek blijven chatten.
//
// Bewust niet in proxy.ts samengevoegd: dat is een kritiek toegangspad dat apart getest wordt (docs/archief/TEAM_PLAN.md). Wijzigt
// de regel in proxy.ts, pas dan ook dit bestand aan; lib/toegangNu.test.ts legt de gevallen vast.
//
// Faalt open bij een databasefout: liever een verlopen gebruiker tijdelijk doorlaten dan betalende gebruikers buitensluiten.
// Iemand zonder rij in approved_users blijft doorgelaten zoals voorheen (de route kent dan het standaardplan en de
// dagelijkse limiet); een rij ontstaat pas als iemand de app opent, en dan gelden de gewone regels.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type Teamrij = { role: string; arnobot_teams: { geblokkeerd_at: string | null } | { geblokkeerd_at: string | null }[] | null }

export async function heeftToegangNu(userId: string, nu: Date = new Date()): Promise<boolean> {
  try {
    const { data: user, error } = await supabase
      .from('approved_users')
      .select('is_active, expires_at, paid_at, trial_start, command_manager')
      .eq('user_id', userId)
      .maybeSingle<{ is_active: boolean | null; expires_at: string | null; paid_at: string | null; trial_start: string | null; command_manager: boolean | null }>()
    if (error) return true
    if (!user) return true
    if (user.is_active === false) return false
    if (datumToegang(user, nu)) return true

    // Teamtoegang is nooit tijdgebonden aan de eigen proef, maar eindigt met een blokkade van het team (en dat raakt alleen
    // toegang die uitsluitend via het team loopt, nooit iemands eigen geldige datums hierboven).
    const { data: lid } = await supabase
      .from('arnobot_team_members')
      .select('role, arnobot_teams(geblokkeerd_at)')
      .eq('user_id', userId)
      .maybeSingle<Teamrij>()
    const team = lid ? (Array.isArray(lid.arnobot_teams) ? lid.arnobot_teams[0] : lid.arnobot_teams) : null
    const teamGeblokkeerd = !!team?.geblokkeerd_at

    if (user.command_manager === true && !(lid?.role === 'manager' && teamGeblokkeerd)) return true
    if (lid) return !teamGeblokkeerd
    return false
  } catch {
    return true
  }
}
