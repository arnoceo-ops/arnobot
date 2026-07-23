import DoorgaanClient from './DoorgaanClient'

export default async function DoorgaanPage() {
  const demoLink = process.env.ARNO_BOOKING_URL ?? null
  return <DoorgaanClient demoLink={demoLink} />
}
