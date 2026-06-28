import { NextResponse } from 'next/server'

export async function GET() {
  const res = NextResponse.redirect(new URL('/bot/admin/login', 'https://arno.bot'))
  res.cookies.set('arnobot_admin', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  })
  return res
}
