// Accounts die bewust buiten alle gebruikersdata blijven: het geautomatiseerde Playwright
// E2E-testaccount en Arno's eigen handmatige testaccount. Beide draaien in dezelfde
// Supabase-tabellen als echte gebruikers (geen apart testproject), dus moeten expliciet
// worden uitgesloten van e-mailcrons en van admin-weergaves (gesprekkenlog, gebruikerslijst,
// statistieken) zodat testdata daar nooit tussen echte gebruikersdata staat.

// Playwright E2E-testaccount (aangemaakt tegen de Clerk development-instance, zie
// e2e/auth.setup.ts).
export const E2E_TEST_USER_EMAIL = 'playwright-test@arno.bot'
export const E2E_TEST_USER_ID = 'user_3GMu51zQ4RJYqgQmpI4NMOwIvK2'

// Arno's eigen handmatige testaccount, voor interactief rondklikken buiten zijn echte
// gebruiksaccount om. Ingelogd via de verborgen route app/sign-in/intern/page.tsx, niet via
// LinkedIn. MANUAL_TEST_USER_ID wordt pas bekend zodra het account in Clerk is aangemaakt.
export const MANUAL_TEST_USER_EMAIL = 'test@arno.bot'
export const MANUAL_TEST_USER_ID = ''
