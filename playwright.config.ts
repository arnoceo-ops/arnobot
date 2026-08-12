import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { MOCK_ANTHROPIC_PORT, MOCK_VOYAGE_PORT } from './e2e/global-setup'

const PORT = 3100
const baseURL = `http://localhost:${PORT}`

// Parsen we zelf, expliciet, in plaats van te vertrouwen op Next.js' eigen .env-precedentie
// binnen het webServer-kindproces: `next dev` forceert intern NODE_ENV=development, en losse
// tests bewezen dat vars uit .env.local (bijv. Upstash Redis) niet betrouwbaar doorkwamen op
// deze manier zodra de echte route-code (niet een page.route-mock) daadwerkelijk draaide.
function parseEnvFile(filename: string): Record<string, string> {
  const envPath = path.resolve(__dirname, filename)
  if (!fs.existsSync(envPath)) return {}
  const parsed: Record<string, string> = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    let value = trimmed.slice(eq + 1)
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    parsed[key] = value
  }
  return parsed
}

// Lokaal: .env.local eerst (Supabase, Upstash, Resend, ...), dan .env.test.local overheen
// (Clerk DEVELOPMENT-sleutels, vervangen de live-sleutels). In CI bestaan deze bestanden niet
// (gitignored); daar zet de workflow de benodigde vars al direct in process.env via GitHub
// Actions secrets, en die hebben dan voorrang boven de (in CI toch lege) bestanden.
const fileOverrides = { ...parseEnvFile('.env.local'), ...parseEnvFile('.env.test.local') }
const testEnvOverrides = { ...fileOverrides, ...process.env }
Object.assign(process.env, testEnvOverrides)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // Start de lokale mock-Anthropic/Voyage-servers vóór de webServer, zodat niveau-3-tests
  // (echte backend, geen page.route-mock) er meteen bij kunnen. Niveau-2-tests (page.route)
  // raken deze servers nooit: die onderscheppen de aanvraag al in de browser.
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npx next dev --webpack -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      ...testEnvOverrides,
      ANTHROPIC_BASE_URL: `http://localhost:${MOCK_ANTHROPIC_PORT}`,
      VOYAGE_BASE_URL: `http://localhost:${MOCK_VOYAGE_PORT}`,
    } as Record<string, string>,
  },
  projects: [
    // Logt eenmalig in via Clerk's Testing Token (omzeilt bot-detectie, officieel
    // ondersteund) en slaat de ingelogde sessie op. Alle andere projects hergebruiken die
    // sessie via storageState, zodat niet elke test opnieuw hoeft in te loggen.
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    // Niveau-3-tests (echte backend-keten, zie backend-integration.spec.ts) horen uitsluitend
    // in de aparte 'chromium-backend'-project, nooit in 'chromium' (niveau-2, page.route-mocks).
    // Eerder via een --grep-invert op titeltekst geregeld, wat fragiel bleek: een nieuwe test
    // in backend-integration.spec.ts zonder exact die titeltekst werd niet uitgesloten en
    // draaide per ongeluk mee in de niveau-2-CI-job, die geen Redis/mock-Anthropic-omgeving
    // heeft (11 augustus 2026). Bestandsnaam-gebaseerde scheiding kan dat niet meer missen.
    {
      name: 'chromium',
      testIgnore: /backend-integration\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-backend',
      testMatch: /backend-integration\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
})
