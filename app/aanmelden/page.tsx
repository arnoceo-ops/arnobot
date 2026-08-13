'use client'
import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function AanmeldenInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      document.cookie = `arnobot_ref=${ref}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`
    }
    // Sales-development-attributie: alleen een cookie zetten, de daadwerkelijke controle tegen
    // de bekende tokens gebeurt server-side in proxy.ts bij accountaanmaak. Een ongeldige/
    // geraden waarde hier doet dus niets, dat wordt pas serverside geverifieerd.
    const sd = searchParams.get('sd')
    if (sd) {
      document.cookie = `arnobot_sd=${sd}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`
    }
    router.replace('/sign-in')
  }, [searchParams, router])

  return null
}

export default function AanmeldenPage() {
  return (
    <Suspense>
      <AanmeldenInner />
    </Suspense>
  )
}
