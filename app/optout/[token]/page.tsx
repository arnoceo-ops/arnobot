import OptOutClient from './OptOutClient'

export default async function OptOutPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ sig?: string }>
}) {
  const { token } = await params
  const { sig } = await searchParams
  return <OptOutClient token={token} sig={sig ?? ''} />
}
