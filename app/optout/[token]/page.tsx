import OptOutClient from './OptOutClient'

export default async function OptOutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <OptOutClient token={token} />
}
