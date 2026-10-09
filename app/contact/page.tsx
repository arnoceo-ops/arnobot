import type { Metadata } from 'next'
import PublicNav from '@/app/components/PublicNav'
import { BEDRIJF } from '@/lib/bedrijf'
import { SUPPORT_WHATSAPP_VRAAG } from '@/lib/support'

export const metadata: Metadata = {
  title: 'Contact: ArnoBot',
  description: 'Bedrijfsgegevens van ArnoBot en hoe je ons bereikt. Je krijgt binnen 24 uur antwoord.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.arno.bot/contact' },
  openGraph: {
    title: 'Contact: ArnoBot',
    description: 'Bedrijfsgegevens van ArnoBot en hoe je ons bereikt. Je krijgt binnen 24 uur antwoord.',
    url: 'https://www.arno.bot/contact',
    siteName: 'ArnoBot',
    locale: 'nl_NL',
    type: 'website',
    images: '/opengraph-image',
  },
  twitter: { card: 'summary_large_image' },
}

const label = { fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 } as const
const h2 = { fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 } as const
const rij = { color: '#f1f5f9', width: '40%' } as const

export default function ContactPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        a { color: #f59e0b; text-decoration: none; }
        a:hover { text-decoration: underline; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        td { font-family: 'Space Mono', monospace; font-size: 15px; color: #9ca3af; padding: 10px 14px; border-bottom: 1px solid #374151; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        .contact-links a { font-family: 'Space Mono', monospace; font-size: 13px; letter-spacing: 4px; color: #6b7280; text-decoration: none; text-transform: uppercase; margin-right: 24px; }
        .contact-links a:hover { color: #f1f5f9; }
      `}</style>

      <PublicNav />

      <div style={{ minHeight: '100vh', background: '#111827' }}>
        <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

          <p style={label}>ARNOBOT</p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1.0, marginBottom: 16 }}>CONTACT.</h1>
          <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 48 }}>
            Vragen over ArnoBot, je account of je gegevens? Stuur een mail en je krijgt {BEDRIJF.reactietermijn} antwoord.
          </p>

          <div style={{ borderTop: '2px solid #f59e0b', paddingTop: 32, marginBottom: 48 }}>
            <p style={label}>BEREIKBAARHEID</p>
            <h2 style={h2}>Hoe je ons bereikt</h2>
            <table>
              <tbody>
                <tr><td style={rij}>Algemeen</td><td><a href={`mailto:${BEDRIJF.emailAlgemeen}`}>{BEDRIJF.emailAlgemeen}</a></td></tr>
                <tr><td style={{ color: '#f1f5f9' }}>Support</td><td><a href={SUPPORT_WHATSAPP_VRAAG} target="_blank" rel="noopener noreferrer">WhatsApp</a></td></tr>
                <tr><td style={{ color: '#f1f5f9' }}>Privacy</td><td><a href={`mailto:${BEDRIJF.emailPrivacy}`}>{BEDRIJF.emailPrivacy}</a></td></tr>
                <tr><td style={{ color: '#f1f5f9' }}>Opzeggen</td><td><a href={`mailto:${BEDRIJF.emailOpzeggen}`}>{BEDRIJF.emailOpzeggen}</a></td></tr>
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={label}>BEDRIJFSGEGEVENS</p>
            <h2 style={h2}>Wie er achter ArnoBot zit</h2>
            <table>
              <tbody>
                <tr><td style={rij}>Bedrijf</td><td>{BEDRIJF.naam}</td></tr>
                <tr><td style={{ color: '#f1f5f9' }}>Eigenaar</td><td>{BEDRIJF.eigenaar}</td></tr>
                <tr><td style={{ color: '#f1f5f9' }}>KvK-nummer</td><td>{BEDRIJF.kvk}</td></tr>
                {BEDRIJF.btw && <tr><td style={{ color: '#f1f5f9' }}>Btw-nummer</td><td>{BEDRIJF.btw}</td></tr>}
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Bezoekadres</td>
                  <td>{BEDRIJF.straat}<br />{BEDRIJF.postcode} {BEDRIJF.plaats}, {BEDRIJF.land}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="contact-links" style={{ borderTop: '1px solid #374151', paddingTop: 32 }}>
            <a href="/privacy">Privacy</a>
            <a href="/voorwaarden">Voorwaarden</a>
            <a href="/arnobot-beveiliging.pdf">Beveiliging</a>
          </div>

        </div>
      </div>
    </>
  )
}
