// Achtergrondscript van de admin-app (/bot/admin/mobiel). Toont alleen pushmeldingen en opent de app bij
// een tik. Bewust geen fetch-handler en geen cache: er blijft geen bedrijfs- of gebruikersdata op de telefoon.

const PAGINA = '/bot/admin/mobiel'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('push', (event) => {
  let bericht = {}
  try { bericht = event.data ? event.data.json() : {} } catch { /* leeg of kapot bericht: toch iets tonen */ }
  event.waitUntil(self.registration.showNotification(bericht.titel || 'ArnoBot Admin', {
    body: bericht.tekst || 'Open de app voor de status.',
    tag: bericht.tag || 'admin',
    renotify: true,
    icon: '/admin-icoon-v2-192.png',
    badge: '/admin-badge-96.png',
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const vensters = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = vensters.find((v) => new URL(v.url).pathname === PAGINA)
    if (open) {
      await open.focus()
      // Ververst de pagina, zodat de stippen van nu te zien zijn.
      open.postMessage('ververs')
      return
    }
    await self.clients.openWindow(PAGINA)
  })())
})

// De browser vernieuwt de aanmelding: opnieuw doorgeven. Lukt dat niet, dan doet de app het bij de volgende keer openen.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const abonnement = event.newSubscription
      || (event.oldSubscription && await self.registration.pushManager.subscribe(event.oldSubscription.options))
    if (!abonnement) return
    await fetch('/api/admin/mobiel/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actie: 'aanmelden', abonnement }),
    })
  })())
})
