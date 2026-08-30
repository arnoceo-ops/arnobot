import type { Metadata } from "next";
import { Geist, Geist_Mono, Bebas_Neue } from "next/font/google";
import { headers } from "next/headers";
import ClerkAppProvider from "./ClerkAppProvider";
import SentryUserIdentifier from "./components/SentryUserIdentifier";
import PageviewTracker from "./components/PageviewTracker";
import PostHogTracker from "./components/PostHogTracker";
import PostHogSessionReplay from "./components/PostHogSessionReplay";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});

export const metadata: Metadata = {
  title: 'ArnoBot: Jouw Personal Sales Coach',
  description: 'ArnoBot is jouw persoonlijke salescoach. Gebaseerd op 40 jaar sales executie, 30 jaar bedrijven bouwen, 20 jaar blogs schrijven en 15 jaar scaling up coaching. 24/7 beschikbaar.',
  robots: { index: false, follow: false },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ArnoBot',
  url: 'https://www.arno.bot',
  logo: 'https://www.arno.bot/arnobot-logo.png',
  description: 'ArnoBot is een AI-salescoach, gebaseerd op 40 jaar sales executie, 30 jaar bedrijven bouwen, 20 jaar blogs schrijven en 15 jaar scaling up coaching.',
  founder: {
    '@type': 'Person',
    name: 'Arno Diepeveen',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <ClerkAppProvider nonce={nonce}>
      <html lang="nl" style={{ backgroundColor: '#111827', colorScheme: 'dark' }}>
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} antialiased`}
        >
          <script
            type="application/ld+json"
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
          />
          <SentryUserIdentifier />
          <PageviewTracker />
          <PostHogTracker />
          <PostHogSessionReplay />
          {children}
        </body>
      </html>
    </ClerkAppProvider>
  );
}
