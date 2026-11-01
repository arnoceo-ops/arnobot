// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Zie sentry.server.config.ts: alleen aanzetten bij zekerheid over productie (pk_live_
// EN NODE_ENV === 'production'), niet alleen uitzetten bij zekerheid over een test. Een
// lege/onbekende sleutel (bijv. een CI-run zonder geconfigureerde secrets, live gevonden
// 2026-07) mag nooit als productiefout doorgestuurd worden, en lokale `next dev` met een
// bewust echte pk_live_-key in .env.local ook niet (live gevonden 2026-08).
const isProduction = process.env.NODE_ENV === 'production'
  && (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_') ?? false)

Sentry.init({
  dsn: "https://2b3a04a34d25d646ead9df3c13aee53e@o4511097015828480.ingest.de.sentry.io/4511703887118416",
  enabled: isProduction,

  // Zie sentry.server.config.ts: scanner-ruis op een gegokte Next-Action-header hier filteren
  // i.p.v. in proxy.ts blokkeren, dat brak eerder @clerk/nextjs's eigen signOut()-actie.
  ignoreErrors: [/Failed to find Server Action/],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.1,


  dataCollection: {
    // Bewust de restrictieve v10-basis: v11 verzamelt zonder deze regels standaard gebruikersinfo,
    // cookies, request- en response-bodies, GenAI-inputs en -outputs en databasequerydata. In
    // ArnoBot staat daar gespreks- en coachinginhoud tussen, en dat hoort niet bij Sentry.
    // Laat dit blok nooit leeg (leeg = ruim verzamelen).
    userInfo: false,
    cookies: false,
    httpHeaders: {
      request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    },
    httpBodies: [],
    urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    graphQL: { document: false, variables: false },
  },
});
