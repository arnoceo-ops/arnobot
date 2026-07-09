import * as Sentry from '@sentry/nextjs'

export async function GET() {
  const error = new Error('Sentry server-side test — verwijder na verificatie')
  Sentry.captureException(error)
  await Sentry.flush(2000)
  throw error
}
