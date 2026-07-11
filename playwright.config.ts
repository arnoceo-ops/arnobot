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

// .env.local eerst (alle gewone project-env-vars: Supabase, Upstash, Resend, ...), dan
// .env.test.local overheen (de Clerk DEVELOPMENT-sleutels, vervangen de live-sleutels).
const testEnvOverrides = { ...parseEnvFile('.env.local'), ...parseEnvFile('.env.test.local') }
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
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
})
