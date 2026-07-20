import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Stabiele interne link (in e-mails en de account-pagina) naar het boekingsformulier voor het
// gesprek met Arno. De daadwerkelijke tool staat in ARNO_BOOKING_URL, zodat wisselen van tool
// later alleen een env var-wijziging is, geen codewijziging en geen kapotte oude e-maillinks.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.redirect(new URL('https://arno.bot/sign-in'))

  const bookingUrl = process.env.ARNO_BOOKING_URL
  if (!bookingUrl) {
    console.error('[bot/gesprek] ARNO_BOOKING_URL ontbreekt')
    return NextResponse.redirect(new URL('https://arno.bot/bot/account'))
  }

  const { data } = await supabase
    .from('approved_users')
    .select('email, voornaam, achternaam')
    .eq('user_id', userId)
    .single()

  const url = new URL(bookingUrl)
  if (data?.email) url.searchParams.set('email', data.email)
  const naam = [data?.voornaam, data?.achternaam].filter(Boolean).join(' ')
  if (naam) url.searchParams.set('name', naam)

  return NextResponse.redirect(url)
}
