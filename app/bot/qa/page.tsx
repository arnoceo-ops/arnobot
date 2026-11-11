import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { logEvent } from '@/lib/events'
import QAClient from './QAClient'

export default async function QAPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  logEvent(userId, 'qa_page_view')

  return <QAClient />
}
