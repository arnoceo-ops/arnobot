import { NextRequest, NextResponse } from 'next/server'
import { registreerCronRun } from '@/lib/cronRun'
import { notifyCronFailure } from '@/lib/cron-notify'
import { draaiReferralUitvoeren } from '@/lib/billing/referralUitvoeren'

// Dagelijkse uitvoerronde van de referralautomatisering, na billing (05:00), teamfacturatie (05:10) en het grootboek
// (05:20). Zonder de SQL doet hij niets. Met REFERRAL_TERUGSTORTEN uit wordt niets gereserveerd of verstuurd; wat al
// onderweg was wordt wel afgehandeld. Zie lib/billing/referralUitvoeren.ts.
export const maxDuration = 300

async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const uit = await draaiReferralUitvoeren(new Date())
    // De meldingen komen niet vanzelf terug: dan telt de run als mislukt, zodat het opvalt.
    if (uit.meldingMislukt) return NextResponse.json({ error: 'Melding niet verstuurd' }, { status: 500 })
    return NextResponse.json({ ok: true, ...uit })
  } catch (e) {
    await notifyCronFailure('referral-uitvoeren', e)
    return NextResponse.json({ error: 'Referral uitvoeren mislukt' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/referral-uitvoeren', cronHandler)
