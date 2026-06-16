import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import TeamClient from './TeamClient'

const BOUWER_EMAIL = 'linkedin@royaldutchsales.com'

export default async function TeamPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress ?? ''
  if (email !== BOUWER_EMAIL) redirect('/bot')
  return <TeamClient />
}
