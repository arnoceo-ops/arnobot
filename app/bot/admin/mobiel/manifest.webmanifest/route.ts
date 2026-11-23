// Manifest voor de beginscherm-app van de admin-telefoonpagina (alleen Android, alleen Arno).
// Een route i.p.v. de manifest.ts-conventie van Next: die werkt alleen in de hoofdmap van app/ en gaf
// hier een 404 (gemeten 2026-11-23), waardoor Chrome alleen een gewone snelkoppeling maakte.
// scope '/' i.p.v. '/bot/admin/mobiel': de inlog loopt via /sign-in en LinkedIn en moet in hetzelfde
// appvenster blijven. Manifest en icoonroute bevatten geen gegevens, dus geen inlog nodig.
// id: de identiteit van de app voor Chrome. Gewijzigd van '/bot/admin/mobiel' naar '/admin-mobiel-2' op 2026-11-23, omdat een
// eerder geïnstalleerde versie met het oude icoon bleef hangen. Een nieuw id geeft een nieuwe installatie. Wijzig het alleen
// bewust opnieuw: bestaande installaties zien dit dan als een andere app.
export const dynamic = 'force-static'

const MANIFEST = {
  id: '/admin-mobiel-2',
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
    { src: '/admin-icoon-v2-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/admin-icoon-v2-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/admin-icoon-v2-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

export function GET() {
  return new Response(JSON.stringify(MANIFEST), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-cache',
    },
  })
}
