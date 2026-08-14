import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import SdVerdienClient from './SdVerdienClient'

export const dynamic = 'force-dynamic'

export default async function SdVerdienPage() {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('arnobot_admin')?.value
  const isAdmin = !!adminToken && adminToken === process.env.ARNOBOT_ADMIN_KEY

  if (isAdmin) {
    return <SdVerdienClient isAdmin />
  }

  const sdToken = cookieStore.get('arnobot_sd_verdien')?.value
  if (!sdToken || sdToken !== process.env.SD_VERDIEN_PASSWORD) {
    redirect('/agents/login')
  }

  return <SdVerdienClient isAdmin={false} />
}
