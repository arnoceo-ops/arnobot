import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (password !== process.env.ARNOBOT_ADMIN_KEY) {
    // Vertraging bij fout wachtwoord: maakt brute force 500ms per poging
    await new Promise(r => setTimeout(r, 500))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('arnobot_admin', process.env.ARNOBOT_ADMIN_KEY!, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 2,
    path: '/',
  })
  return res
}
