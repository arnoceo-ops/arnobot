import { cookies } from 'next/headers'
import { timingSafeEqual } from 'crypto'

// Admin-sessie: de cookie arnobot_admin moet gelijk zijn aan ARNOBOT_ADMIN_KEY (zie ook
// /bot/admin/login). Constante-tijd-vergelijking, zodat de sleutel niet via responstijd
// te raden is. Nieuwe admin-routes gebruiken deze helper i.p.v. de check in te plakken.
export async function isAdminSession(): Promise<boolean> {
  const expected = process.env.ARNOBOT_ADMIN_KEY
  if (!expected) return false
  const store = await cookies()
  const token = store.get('arnobot_admin')?.value
  if (!token) return false
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Constante-tijd-vergelijking van een meegegeven token (cookie, header of loginwachtwoord)
// met ARNOBOT_ADMIN_KEY. Gebruik dit overal i.p.v. `token === process.env.ARNOBOT_ADMIN_KEY`.
export function adminKeyMatches(token: string | null | undefined): boolean {
  const expected = process.env.ARNOBOT_ADMIN_KEY
  if (!expected || !token) return false
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
