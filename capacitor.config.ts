import type { CapacitorConfig } from '@capacitor/cli'

// Remote laden: de shell laadt arno.bot zoals een gewone browser, in plaats van een
// statische export te bundelen. Architectuurbesluit + onderbouwing in docs/MOBILE_PLAN.md
// (proxy.ts en next.config.ts zijn hierdoor bewust ongewijzigd, geen CORS/CSP-aanpassing
// nodig: de WebView draait letterlijk het arno.bot-origin, zoals in een normale browser).
//
// url wijst rechtstreeks naar www.arno.bot (het canonieke domein waar arno.bot altijd naar
// doorstuurt, bevestigd via een 308-redirect-test eerder deze sessie), niet naar arno.bot
// zelf: Capacitor's WebView staat alleen navigatie toe binnen het exact geconfigureerde
// domein, dus de eerste doorstuur-hop zou anders al naar de systeembrowser escaleren i.p.v.
// binnen de app te laden (live geverifieerd: content laadde correct maar in Chrome, niet in
// de app). allowNavigation als vangnet voor latere in-app-redirects (bv. Clerk-login via
// clerk.arno.bot), zodat die ook binnen de WebView blijven i.p.v. naar de browser te springen.
const config: CapacitorConfig = {
  appId: 'arno.bot',
  appName: 'ArnoBot',
  webDir: 'public',
  server: {
    url: 'https://www.arno.bot',
    androidScheme: 'https',
    allowNavigation: ['arno.bot', 'www.arno.bot', 'clerk.arno.bot'],
  },
}

export default config
