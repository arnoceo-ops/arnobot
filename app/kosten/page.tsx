import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import KostenPageClient from './KostenPageClient'

export const dynamic = 'force-dynamic'

export default async function KostenPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_kosten')?.value
  if (!token || token !== process.env.ARNOBOT_KOSTEN_KEY) redirect('/kosten/login')

  return <KostenPageClient />
}
