import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ArnoBot: Team aanvragen',
  description: 'Vraag ArnoBot Team aan voor je salesteam: meerdere gebruikers onder één deal, elke gebruiker een eigen ArnoBot plus jouw managerdashboard.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.arno.bot/team/aanvragen' },
  openGraph: {
    title: 'ArnoBot: Team aanvragen',
    description: 'Vraag ArnoBot Team aan voor je salesteam: meerdere gebruikers onder één deal, elke gebruiker een eigen ArnoBot plus jouw managerdashboard.',
    url: 'https://www.arno.bot/team/aanvragen',
    siteName: 'ArnoBot',
    locale: 'nl_NL',
    type: 'website',
    images: '/opengraph-image',
  },
  twitter: { card: 'summary_large_image' },
}

export default function TeamAanvragenLayout({ children }: { children: React.ReactNode }) {
  return children
}
