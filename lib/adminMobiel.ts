import { auth, clerkClient } from '@clerk/nextjs/server'

// Toegang tot de telefoonpagina /bot/admin/mobiel. Los van het oude admin-wachtwoord
// (lib/adminAuth.ts): hier telt alleen Arno's eigen Clerk-account (linkedin@royaldutchsales.com),
// dat een geverifieerde LinkedIn-koppeling moet hebben. De tweestapsverificatie zit bij
// LinkedIn zelf en is niet door Clerk te controleren (besluit 2026-11-23, op Arno's bevestiging
// dat zijn LinkedIn 2FA aan heeft). Een Clerk-gebruikers-ID is geen geheim, dus een vaste waarde.
export const ADMIN_MOBIEL_USER_ID = 'user_3Eg9FPzi0PlJEPI3togJKyoyXE6'
export const LINKEDIN_PROVIDER = 'oauth_linkedin_oidc'

export type MobielToegang =
  | { ok: true }
  | { ok: false; reden: 'niet-ingelogd' | 'ander-account' | 'geen-linkedin' }

// Pure beslisregel, los getest. Volgorde: eerst ingelogd, dan het juiste account, dan LinkedIn.
export function beslisMobielToegang(
  userId: string | null,
  heeftLinkedIn: boolean,
): MobielToegang {
  if (!userId) return { ok: false, reden: 'niet-ingelogd' }
  if (userId !== ADMIN_MOBIEL_USER_ID) return { ok: false, reden: 'ander-account' }
  if (!heeftLinkedIn) return { ok: false, reden: 'geen-linkedin' }
  return { ok: true }
}

// Echte controle: Clerk-sessie + op dat moment opgehaalde accountstatus, zodat het loskoppelen
// van LinkedIn direct de toegang sluit. Let op: Clerk geeft niet door met welke methode de huidige
// sessie is gestart. Het account heeft ook een wachtwoord, dat in het Clerk-dashboard weg kan.
export async function controleerMobielToegang(): Promise<MobielToegang> {
  const { userId } = await auth()
  if (!userId || userId !== ADMIN_MOBIEL_USER_ID) return beslisMobielToegang(userId, false)
  const client = await clerkClient()
  const gebruiker = await client.users.getUser(userId)
  const heeftLinkedIn = gebruiker.externalAccounts.some(
    a => a.provider === LINKEDIN_PROVIDER && a.verification?.status === 'verified',
  )
  return beslisMobielToegang(userId, heeftLinkedIn)
}
