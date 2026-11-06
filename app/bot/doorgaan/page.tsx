import DoorgaanClient from './DoorgaanClient'
import BotNav from '../BotNav'
import HideInNativeApp from '@/app/components/HideInNativeApp'

export default async function DoorgaanPage() {
  const demoLink = process.env.ARNO_BOOKING_URL ?? null
  return (
    <HideInNativeApp
      fallback={
        <>
          <style>{`
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
          `}</style>
          <BotNav active="account" />
          <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>
            <p style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>ARNOBOT</p>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, lineHeight: 1, color: '#f1f5f9', marginBottom: 32 }}>
              GEEN TOEGANG
            </h1>
            <p style={{ color: '#9ca3af', fontSize: 15, lineHeight: 1.9 }}>
              Dit account heeft op dit moment geen toegang tot ArnoBot.
            </p>
          </div>
        </>
      }
    >
      <DoorgaanClient demoLink={demoLink} />
    </HideInNativeApp>
  )
}
