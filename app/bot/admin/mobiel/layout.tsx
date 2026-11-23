import type { Metadata, Viewport } from 'next'

// Het manifest en de iconen worden hier expliciet gekoppeld: de bestandsconventies van Next werken alleen
// in de hoofdmap van app/. De iconen overschrijven die van de rest van de site, zodat ook een gewone
// snelkoppeling het amberkleurige admin-icoon krijgt.
export const metadata: Metadata = {
  title: 'ArnoBot Admin',
  robots: { index: false, follow: false },
  manifest: '/bot/admin/mobiel/manifest.webmanifest',
  icons: {
    icon: [{ url: '/bot/admin/mobiel/icoon/192', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/bot/admin/mobiel/icoon/192', sizes: '192x192', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#111827',
}

export default function MobielLayout({ children }: { children: React.ReactNode }) {
  return children
}
