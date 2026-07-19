import type { CapacitorConfig } from '@capacitor/cli'

// Remote laden: de shell laadt https://arno.bot zoals een gewone browser, in plaats van
// een statische export te bundelen. Architectuurbesluit + onderbouwing in docs/MOBILE_PLAN.md
// (middleware.ts en next.config.ts zijn hierdoor bewust ongewijzigd, geen CORS/CSP-aanpassing
// nodig: de WebView draait letterlijk het arno.bot-origin, zoals in een normale browser).
const config: CapacitorConfig = {
  appId: 'arno.bot',
  appName: 'ArnoBot',
  webDir: 'public',
  server: {
    url: 'https://arno.bot',
    androidScheme: 'https',
  },
}

export default config
