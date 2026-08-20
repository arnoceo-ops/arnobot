import { clerk, clerkSetup } from '@clerk/testing/playwright'
import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

export const TEST_USER_EMAIL = 'playwright-test@arno.bot'
const AUTH_FILE = 'e2e/.auth/user.json'

// Representatief testprofiel, zodat de systeemprompt (buildRdsSystemPrompt) een compleet
// profiel heeft om mee te werken, net als bij een echte gebruiker.
const TEST_PROFILE = {
  rol: 'Sales Director',
  jaren_functie: 5,
  markt: ['B2B SaaS'],
  wat_verkoop_je: 'Software voor projectplanning',
  ideale_klant: 'Middelgrote bouwbedrijven',
  uitdaging: 'Langere salescyclus dan verwacht',
  dealgrootte: '10.000 - 25.000 euro',
  salescyclus: '3 tot 6 maanden',
  teamgrootte: 4,
}

// Logt eenmalig in via Clerk's Testing Token-mechanisme (officieel ondersteund, omzeilt
// bot-detectie). Werkt alleen tegen een Clerk DEVELOPMENT-instance (@clerk/testing weigert
// een production secret key). De ingelogde sessie wordt opgeslagen zodat alle andere tests
// niet opnieuw hoeven in te loggen.
setup('authenticeren als testgebruiker', async ({ page }) => {
  await clerkSetup()

  // Navigeer eerst naar een publieke pagina die Clerk laadt, vereist door clerk.signIn().
  await page.goto('/')
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL })

  // Eerste bezoek aan /bot triggert proxy.ts om automatisch een approved_users-rij aan
  // te maken (trial-start). Op de allereerste run ooit stuurt dat door naar /bot/welkom
  // (welcome_seen nog niet gezet); op elke volgende run is het account al geseed door een
  // vorige testrun en komt de test meteen op /bot. Beide gevallen moeten werken, niet alleen
  // de eerste keer.
  await page.goto('/bot')

  // Profiel altijd opnieuw upserten met de actuele TEST_PROFILE, niet alleen bij de
  // allereerste run. Op elke run ná de eerste stond hier voorheen alleen de onboarding-check
  // (welkom/profiel-redirect), waardoor een stale profiel uit een oudere testrun (bv. een
  // inmiddels hernoemde rolwaarde) nooit werd bijgewerkt en de app op een verouderde waarde
  // bleef matchen. Idempotent (upsert), dus veilig om altijd uit te voeren.
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: userData } = await supabase
    .from('approved_users')
    .select('user_id')
    .eq('email', TEST_USER_EMAIL)
    .single()
  if (!userData) throw new Error(`approved_users-rij voor ${TEST_USER_EMAIL} niet gevonden na eerste /bot-bezoek`)

  await supabase.from('approved_users').update({ welcome_seen: true, onboarding_done: true }).eq('user_id', userData.user_id)
  await supabase.from('arnobot_blog_profiles').upsert({ user_id: userData.user_id, profiel: TEST_PROFILE }, { onConflict: 'user_id' })

  if (page.url().includes('/bot/welkom') || page.url().includes('/bot/profiel')) {
    await page.goto('/bot')
  }

  await page.waitForURL(/\/bot$/)

  await page.context().storageState({ path: AUTH_FILE })
})
