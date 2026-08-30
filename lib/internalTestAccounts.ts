// Accounts die bewust buiten alle gebruikersdata blijven: het geautomatiseerde Playwright
// E2E-testaccount, Arno's eigen handmatige testaccount, en het Google Play-reviewer-account.
// Alle drie draaien in dezelfde Supabase-tabellen als echte gebruikers (geen apart
// testproject), dus moeten expliciet worden uitgesloten van e-mailcrons en van
// admin-weergaves (gesprekkenlog, gebruikerslijst, statistieken) zodat testdata daar nooit
// tussen echte gebruikersdata staat.

// Playwright E2E-testaccount (aangemaakt tegen de Clerk development-instance, zie
// e2e/auth.setup.ts). Account is al eens eerder verdwenen en opnieuw aangemaakt
// (10-11 aug 2026, zie geheugen), met een nieuwe Clerk user-ID tot gevolg — bleek
// op 12 aug 2026 weer te zijn gebeurd (gevonden via een E2E-rate-limit-melding in
// Telegram en testdata die ongefilterd in /bot/admin verscheen). Root cause van de
// verdwijning is nooit gevonden, kan dus weer gebeuren: bij een volgende mismatch
// het huidige ID controleren in het Clerk-dashboard (Development-instance).
export const E2E_TEST_USER_EMAIL = 'playwright-test@arno.bot'
export const E2E_TEST_USER_ID = 'user_3GMu51zQ4RJYqgQmpI4NMOwIvK2'

// Arno's eigen handmatige testaccount, voor interactief rondklikken buiten zijn echte
// gebruiksaccount om. Ingelogd via de verborgen route app/sign-in/intern/page.tsx, niet via
// LinkedIn.
export const MANUAL_TEST_USER_EMAIL = 'test@arno.bot'
export const MANUAL_TEST_USER_ID = 'user_3HFvMfJ8ztQxatkJg3SWdSJPz4D'

// Google Play-reviewer-account, aangemaakt 2026-07-26 rechtstreeks in Clerk Dashboard voor
// app-store-toegang (geen echte gebruiker). Zie docs/MOBILE_PLAN.md voor de volledige
// toedracht.
export const APP_REVIEWER_EMAIL = 'reviewer@arno.bot'
export const APP_REVIEWER_ID = 'user_3H5QqLMsGDjwk1mFQYRCLuJbdBk'

// Alle drie de interne test-user-ID's als lijst, plus een helper. Gebruik dit op ELKE
// gebruikersoverstijgende aggregatie of analyse over gebruikersdata (admin-overzichten,
// cron-analyses, ranglijsten, opener-generatie): de geautomatiseerde E2E draait tegen een
// apart Supabase-project, maar test@arno.bot (handmatig via /sign-in/intern) en
// reviewer@arno.bot loggen in op de productie-Clerk en schrijven dus naar dezelfde
// productie-tabellen als echte gebruikers. Zonder deze filter belandt hun testverkeer in
// weekcijfers, competitie-ranglijsten en de gegenereerde gespreksopeners.
// scripts/check-testaccount-filter.mjs is de CI-achtervang.
export const INTERNAL_TEST_USER_IDS: readonly string[] = [
  E2E_TEST_USER_ID,
  MANUAL_TEST_USER_ID,
  APP_REVIEWER_ID,
]

export const INTERNAL_TEST_USER_EMAILS: readonly string[] = [
  E2E_TEST_USER_EMAIL,
  MANUAL_TEST_USER_EMAIL,
  APP_REVIEWER_EMAIL,
]

export function isInternalTestUser(userId: string | null | undefined): boolean {
  return userId != null && INTERNAL_TEST_USER_IDS.includes(userId)
}

// PostgREST-filter voor een Supabase-query: sluit de interne testaccounts uit op `column`
// (default user_id). Equivalent aan drie losse .neq()-calls, maar in één greppbare vorm.
export function excludeInternalTestUsers<T extends { not(column: string, operator: 'in', value: string): T }>(
  query: T,
  column = 'user_id',
): T {
  return query.not(column, 'in', `(${INTERNAL_TEST_USER_IDS.join(',')})`)
}

// Team Hippios: persistent testteam voor demo's/livetesten, twee echte managers
// (test@arno.bot, thijs@tenshare.nl) + drie fake teamleden. Nieuw gegenereerde content
// (1:1's, team-analyses) mag tijdens een demo/test wel getoond worden, maar wordt bewust NIET
// opgeslagen (Arno's expliciete verzoek, 2026-08-22): anders drift de zorgvuldig samengestelde
// testdata bij elke demo verder weg van de gecureerde uitgangssituatie. Alleen al opgeslagen
// content blijft staan. Zie de guard in team/1on1/save/route.ts en team/spotlight/route.ts.
export const TEST_TEAM_ID = '5b29bd9b-762b-4834-a532-d40efa87a43f'
