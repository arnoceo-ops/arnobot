import type { MetadataRoute } from 'next'

// Manifest voor de beginscherm-app van de admin-telefoonpagina (alleen Android, alleen Arno).
// scope '/' i.p.v. '/bot/admin/mobiel': de inlog loopt via /sign-in en LinkedIn en moet in
// hetzelfde appvenster blijven, anders opent Chrome die stappen in een apart tabblad.
// De icoonroute en het manifest zelf bevatten geen gegevens, dus geen inlog nodig.
export default function manifest(): MetadataRoute.Manifest {
  return {
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
}
