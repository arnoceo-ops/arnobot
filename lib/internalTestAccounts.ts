// Accounts die bewust buiten alle gebruikersdata blijven: het geautomatiseerde Playwright
// E2E-testaccount en Arno's eigen handmatige testaccount. Beide draaien in dezelfde
// Supabase-tabellen als echte gebruikers (geen apart testproject), dus moeten expliciet
// worden uitgesloten van e-mailcrons en van admin-weergaves (gesprekkenlog, gebruikerslijst,
// statistieken) zodat testdata daar nooit tussen echte gebruikersdata staat.

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
