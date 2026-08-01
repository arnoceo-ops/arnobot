// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Zie sentry.server.config.ts: alleen aanzetten bij zekerheid over productie (pk_live_
// EN NODE_ENV === 'production'), niet alleen uitzetten bij zekerheid over een test. Een
// lege/onbekende sleutel (bijv. een CI-run zonder geconfigureerde secrets, live gevonden
// 2026-07) mag nooit als productiefout doorgestuurd worden, en lokale `next dev` met een
// bewust echte pk_live_-key in .env.local ook niet (live gevonden 2026-08). NODE_ENV is
// hier veilig te gebruiken (geen NEXT_PUBLIC_-prefix nodig): Next.js inlinet NODE_ENV
// altijd ook in de clientbundel, in tegenstelling tot gewone server-only env vars.
const isProduction = process.env.NODE_ENV === 'production'
  && (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_') ?? false)

Sentry.init({
  dsn: "https://2b3a04a34d25d646ead9df3c13aee53e@o4511097015828480.ingest.de.sentry.io/4511703887118416",
  tunnel: "/monitoring",
  enabled: isProduction,

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
