import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ArnoBot: Team aanvragen',
  description: 'Vraag ArnoBot Team aan voor je salesteam: meerdere gebruikers onder één deal, elke gebruiker een eigen ArnoBot plus jouw managerdashboard.',
  robots: { index: true, follow: true },
}

export default function TeamAanvragenLayout({ children }: { children: React.ReactNode }) {
  return children
}
