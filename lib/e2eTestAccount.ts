// Playwright E2E-testaccount (aangemaakt tegen de Clerk development-instance, zie
// e2e/auth.setup.ts). Draait in dezelfde Supabase-tabellen als echte gebruikers (geen apart
// testproject), dus moet expliciet worden uitgesloten van e-mailcrons en van admin-
// weergaves (gesprekkenlog, gebruikerslijst, statistieken) zodat testdata daar nooit
// tussen echte gebruikersdata staat.
export const E2E_TEST_USER_EMAIL = 'playwright-test@arno.bot'
export const E2E_TEST_USER_ID = 'user_3GMu51zQ4RJYqgQmpI4NMOwIvK2'
