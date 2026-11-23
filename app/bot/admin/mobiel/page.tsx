import { redirect } from 'next/navigation'
import { controleerMobielToegang } from '@/lib/adminMobiel'

export const dynamic = 'force-dynamic'

const UITLEG: Record<'ander-account' | 'geen-linkedin', string> = {
  'ander-account': 'Dit account heeft geen toegang tot deze pagina.',
  'geen-linkedin': 'Dit account is niet met LinkedIn gekoppeld, dus deze pagina blijft dicht.',
}

export default async function AdminMobielPage() {
  const toegang = await controleerMobielToegang()
  if (!toegang.ok && toegang.reden === 'niet-ingelogd') {
    redirect('/sign-in?redirect_url=/bot/admin/mobiel')
  }

  return (
    <main style={{ background: '#111827', minHeight: '100vh', fontFamily: 'sans-serif', padding: '32px 20px' }}>
      <p style={{ color: '#f59e0b', fontSize: 12, letterSpacing: 4, margin: '0 0 12px' }}>ARNOBOT</p>
      <h1 style={{ color: '#f1f5f9', fontSize: 36, fontWeight: 700, margin: '0 0 24px', letterSpacing: -1 }}>Admin</h1>
      {toegang.ok ? (
        <p style={{ color: '#9ca3af', fontSize: 15 }}>Ingelogd. De kaarten volgen.</p>
      ) : (
        <p style={{ color: '#cc4444', fontSize: 15 }}>{UITLEG[toegang.reden as 'ander-account' | 'geen-linkedin']}</p>
      )}
    </main>
  )
}
