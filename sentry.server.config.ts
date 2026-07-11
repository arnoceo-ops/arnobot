// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Een pk_test_-sleutel betekent dat dit tegen de Clerk development-instance draait (lokale
// Playwright E2E-tests, zie e2e/). Synthetische testfouten (bijv. een bewust geaborteerde
// request in een netwerkfout-scenario) horen niet in Sentry terecht te komen als "fatal"
// productiefout. Productie gebruikt altijd pk_live_, dus dit verzwakt de echte monitoring niet.
const isE2ETestRun = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') ?? false

Sentry.init({
  dsn: "https://2b3a04a34d25d646ead9df3c13aee53e@o4511097015828480.ingest.de.sentry.io/4511703887118416",
  enabled: !isE2ETestRun,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});
