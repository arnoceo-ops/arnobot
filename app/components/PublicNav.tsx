'use client'

import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

export default function PublicNav() {
  const { isSignedIn } = useUser()
  const href = isSignedIn ? '/bot/account' : '/'

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      padding: '0 clamp(20px, 4vw, 40px)', height: 64,
      display: 'flex', alignItems: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(17,24,39,0.95)', backdropFilter: 'blur(12px)',
    }}>
      <Link href={href} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: '#f1f5f9', textDecoration: 'none' }}>
        ARNO<span style={{ color: '#f59e0b' }}>BOT.</span>
      </Link>
    </nav>
  )
}
