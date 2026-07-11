// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Alleen AANZETTEN als zeker is dat dit productie is (pk_live_), in plaats van alleen
// uitzetten als zeker is dat het een test is. Bij een lege/onbekende sleutel (bijv. een
// CI-run vóórdat de benodigde secrets zijn toegevoegd) is de veilige default: geen Sentry-
// rapportage, niet stilzwijgend aannemen dat het productie is. Live gevonden (2026-07): een
// CI-run zonder geconfigureerde secrets had een lege sleutel (niet pk_test_), en de oude
// !isE2ETestRun-logica liet dat gewoon als "productiefout" doorsturen.
const isProduction = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_') ?? false

Sentry.init({
  dsn: "https://2b3a04a34d25d646ead9df3c13aee53e@o4511097015828480.ingest.de.sentry.io/4511703887118416",
  enabled: isProduction,

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
