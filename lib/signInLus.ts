// De inlogpagina start LinkedIn automatisch bij laden. Een nieuwe gebruiker (LinkedIn-account dat Clerk nog niet
// kent) faalt daar met external_account_not_found en landt weer op /sign-in, die opnieuw LinkedIn start: een lus
// (24-11-2026, zie memory project_nieuwe_gebruiker_signin_lus). Bij een tweede automatische start kort na de eerste
// gaat de bezoeker naar /sign-up, dat LinkedIn niet zelf start en dus geen lus kan veroorzaken.

export const SIGNIN_START_KEY = 'arnobot_signin_autostart'
export const SIGNIN_LUS_VENSTER_MS = 2 * 60 * 1000

export function isTerugNaAutoStart(opgeslagen: string | null, nu: number): boolean {
  if (!opgeslagen) return false
  const eerder = Number(opgeslagen)
  if (!Number.isFinite(eerder)) return false
  const verschil = nu - eerder
  return verschil >= 0 && verschil < SIGNIN_LUS_VENSTER_MS
}
