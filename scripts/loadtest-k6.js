// Belastingtest voor k6 (k6 Cloud of lokaal: k6 run scripts/loadtest-k6.js).
// Alleen publieke pagina's en de inlogpoorten. Geen AI-routes, geen formulieren, geen mail, geen betalingen.
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE = 'https://www.arno.bot'

export const options = {
  scenarios: {
    bezoekers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 25 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 250 },
        { duration: '2m', target: 250 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
}

const PAGINAS = ['/', '/prijzen', '/privacy', '/voorwaarden', '/blog']

export default function () {
  const pad = PAGINAS[Math.floor(Math.random() * PAGINAS.length)]
  const r = http.get(BASE + pad)
  check(r, { 'pagina 200': x => x.status === 200 })

  // Een deel van de bezoekers probeert de app: zonder login hoort dat te worden doorgestuurd.
  if (Math.random() < 0.2) {
    const b = http.get(BASE + '/bot', { redirects: 0 })
    check(b, { 'poort stuurt door': x => x.status >= 300 && x.status < 400 })
  }
  // Ongeautoriseerde chat-aanroep hoort te worden afgewezen vóór er een AI-call plaatsvindt.
  if (Math.random() < 0.05) {
    const c = http.post(BASE + '/api/chat', '{}', { headers: { 'Content-Type': 'application/json' } })
    check(c, { 'chat afgewezen': x => x.status === 401 || x.status === 403 })
  }
  sleep(1 + Math.random() * 3)
}
