// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Zie sentry.server.config.ts: alleen aanzetten bij zekerheid over productie (pk_live_),
// niet alleen uitzetten bij zekerheid over een test. Een lege/onbekende sleutel (bijv. een
// CI-run zonder geconfigureerde secrets, live gevonden 2026-07) mag nooit als productiefout
// doorgestuurd worden.
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
