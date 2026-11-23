// Manifest voor de beginscherm-app van de admin-telefoonpagina (alleen Android, alleen Arno).
// Een route i.p.v. de manifest.ts-conventie van Next: die werkt alleen in de hoofdmap van app/ en gaf
// hier een 404 (gemeten 2026-11-23), waardoor Chrome alleen een gewone snelkoppeling maakte.
// scope '/' i.p.v. '/bot/admin/mobiel': de inlog loopt via /sign-in en LinkedIn en moet in hetzelfde
// appvenster blijven. Manifest en icoonroute bevatten geen gegevens, dus geen inlog nodig.
export const dynamic = 'force-static'

const MANIFEST = {
  id: '/bot/admin/mobiel',
  name: 'ArnoBot Admin',
  short_name: 'Admin',
  description: 'Privé-overzicht van ArnoBot',
  start_url: '/bot/admin/mobiel',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#111827',
  theme_color: '#111827',
  icons: [
    { src: '/bot/admin/mobiel/icoon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/bot/admin/mobiel/icoon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/bot/admin/mobiel/icoon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

export function GET() {
  return new Response(JSON.stringify(MANIFEST), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
