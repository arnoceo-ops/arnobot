import type { Metadata } from "next";
import { Geist, Geist_Mono, Bebas_Neue } from "next/font/google";
import { headers } from "next/headers";
import ClerkAppProvider from "./ClerkAppProvider";
import SentryUserIdentifier from "./components/SentryUserIdentifier";
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
  description: 'ArnoBot is jouw persoonlijke salescoach op basis van 20 jaar expertise. 24/7 beschikbaar.',
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <ClerkAppProvider nonce={nonce}>
      <html lang="nl">
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} antialiased`}
        >
          <SentryUserIdentifier />
          {children}
        </body>
      </html>
    </ClerkAppProvider>
  );
}
