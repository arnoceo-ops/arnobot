'use client'

import { useRouter } from 'next/navigation'

export default function PublicNav() {
  const router = useRouter()

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      padding: '0 clamp(20px, 4vw, 40px)', height: 64,
      display: 'flex', alignItems: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(17,24,39,0.95)', backdropFilter: 'blur(12px)',
    }}>
      <button
        onClick={() => router.back()}
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: '#f1f5f9', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        ARNO<span style={{ color: '#f59e0b' }}>BOT.</span>
      </button>
    </nav>
  )
}
