'use client'

import Link from 'next/link'
import { colors, text, layout, globalCss } from '@/lib/styles'

export default function UitnodigingVereistPage() {
  return (
    <>
      <style>{globalCss}</style>
      <div style={layout.page}>
        <div style={layout.container}>
          <p style={{ ...text.label, marginBottom: 8 }}>ARNOBOT</p>
          <h1 style={{ ...text.h1, marginBottom: 16 }}>UITNODIGING VEREIST.</h1>
          <p style={{ ...text.body, marginBottom: 32 }}>
            Jouw bedrijf gebruikt ArnoBot via een teamlicentie. Toegang loopt via een uitnodigingslink van je manager, niet via een losse aanmelding. Vraag je manager om die link.
          </p>
          <Link href="https://arno.bot" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: colors.amber, textDecoration: 'none' }}>
            ← NAAR ARNO.BOT
          </Link>
        </div>
      </div>
    </>
  )
}
