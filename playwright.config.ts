import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const PORT = 3100
const baseURL = `http://localhost:${PORT}`

// .env.test.local bevat de Clerk DEVELOPMENT-sleutels (niet de live-sleutels uit .env.local).
// Expliciet als env vars meegeven aan de webServer-child-process, in plaats van te
// vertrouwen op Next.js' eigen .env-bestand-precedentie: `next dev` forceert intern
// NODE_ENV=development, waardoor Next's eigen "sla .env.local over bij NODE_ENV=test"-
// gedrag niet betrouwbaar is om de productiesleutels te vermijden.
function loadTestEnvOverrides(): Record<string, string> {
  const envPath = path.resolve(__dirname, '.env.test.local')
  if (!fs.existsSync(envPath)) return {}
  const overrides: Record<string, string> = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    overrides[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
  return overrides
}

// Overschrijft process.env vóórdat Playwright of de webServer-child ze leest: dit is de
// enige plek waar de test-omgeving de development-sleutels boven de live-sleutels uit
// .env.local (door Next.js zelf al ergens anders geladen) zet.
const testEnvOverrides = loadTestEnvOverrides()
Object.assign(process.env, testEnvOverrides)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npx next dev --webpack -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...process.env, ...testEnvOverrides } as Record<string, string>,
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
