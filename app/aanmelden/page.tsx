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
