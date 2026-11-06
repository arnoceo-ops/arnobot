import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { password } = await req.json().catch(() => ({}))
  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Wachtwoord moet minimaal 8 tekens zijn.' }, { status: 400 })
  }

  try {
    const client = await clerkClient()
    // Geen currentPassword nodig: dit is Clerk's backend-API, niet de frontend
    // updatePassword()-methode, en werkt daarom ook voor accounts die nog geen
    // wachtwoord hebben (LinkedIn-only-aanmeldingen).
    await client.users.updateUser(userId, { password })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[set-app-password] error:', err instanceof Error ? err.message : String(err))
    // Clerk meldt zelf welke wachtwoordregel niet gehaald is (bv. hoofdletter, cijfer, te zwak of
    // eerder gelekt). Die melding is bedoeld voor de gebruiker en bevat geen interne details.
    const clerkErr = err as { status?: number; errors?: { code?: string; message?: string; longMessage?: string }[] }
    const first = clerkErr?.errors?.[0]
    if (clerkErr?.status === 422 && (first?.longMessage || first?.message)) {
      return NextResponse.json({ error: first.longMessage || first.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Wachtwoord instellen mislukt. Controleer of het voldoet aan de eisen (minimaal 8 tekens).' }, { status: 500 })
  }
}
